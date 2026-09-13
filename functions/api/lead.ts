// Cloudflare Pages Function — owns delivery for the homepage lead-capture
// section ("Get Your Free Medicare Guide"). Browser POST → this function →
// GHL inbound webhook.
//
// Mirrors functions/api/guide-lead.ts and PSG-Main-Website's
// functions/api/route-web-lead.ts: this site is an Astro "static" build with
// no SSR adapter, so Cloudflare Pages picks up /functions/** on top of the
// static output. Forwards to a GHL inbound webhook (env secret) rather than
// calling the GHL REST API directly with a bearer token, since this static
// site has no GHL API token provisioned — same reasoning as guide-lead.ts.

import { checkDisqualification, createDisqualifiedAgentContact, isValidOccupation, flagDomainSignalByEmail, isGateDisabled } from './_shared/agentDisqualification';
import { checkVisitorTargeting } from './_shared/visitorTargeting';

interface Env {
  GHL_WEB_LEAD_WEBHOOK_URL: string;
  GHL_API_TOKEN: string;
  AGENT_GATE_DISABLED?: string;
}

interface LeadPayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status?: string; // dropdown value, mapped to tag_status
  occupation?: string;
  pagePath?: string;
  website?: string; // honeypot — real visitors never fill this
  tcpaConsent?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s()+\-.]{7,20}$/;

const STATUS_TAG_MAP: Record<string, string> = {
  'turning-65': 'turning-65',
  'new-to-medicare': 'new-to-medicare',
  'already-on-medicare': 'already-on-medicare',
  'just-exploring': 'just-exploring',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function forwardToGHL(webhookUrl: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return json({ ok: false, error: 'Expected application/json.' }, 415);
  }

  let body: LeadPayload;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON.' }, 400);
  }

  // Honeypot tripped — pretend success, drop it silently. Don't tip off bots.
  if (body.website) {
    return json({ ok: true });
  }

  const first_name = String(body.first_name ?? '').trim();
  const last_name = String(body.last_name ?? '').trim();
  const email = String(body.email ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const statusRaw = String(body.status ?? '').trim();

  if (!first_name || !last_name || !email) {
    return json({ ok: false, error: 'First name, last name, and email are required.' }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'Enter a valid email address.' }, 400);
  }
  if (phone && !PHONE_RE.test(phone)) {
    return json({ ok: false, error: 'Enter a valid phone number.' }, 400);
  }
  const tag_status = STATUS_TAG_MAP[statusRaw];
  if (!tag_status) {
    return json({ ok: false, error: 'Please select which best describes you.' }, 400);
  }
  if (body.tcpaConsent !== true) {
    return json({ ok: false, error: 'Please agree to be contacted to continue.' }, 400);
  }
  // Kill switch — see isGateDisabled's header comment. When set, every
  // check below (occupation-required, blocklist/occupation reject,
  // domain-signal soft-flag) is skipped entirely and this behaves exactly
  // like the pre-existing "just create the lead" endpoint.
  const gateDisabled = isGateDisabled(env);

  if (!gateDisabled) {
    // Enforced server-side too, not just via the frontend dropdown's
    // `required` attribute — a raw API call must not be able to skip
    // occupation and have it silently treated as "not an agent."
    if (!isValidOccupation(body.occupation)) {
      return json({ ok: false, error: 'Select your occupation.' }, 400);
    }

    // Blocklist check (known individual) then occupation check — reject
    // before the normal webhook-forward flow below ever fires (that's what
    // creates the full GHL contact). Only a minimal throwaway contact is
    // created, for visibility, not follow-up.
    if (env.GHL_API_TOKEN) {
      const result = await checkDisqualification(env.GHL_API_TOKEN, { occupation: body.occupation, email, phone });
      if (result.disqualified) {
        try {
          await createDisqualifiedAgentContact(env.GHL_API_TOKEN, {
            firstName: first_name,
            lastName: last_name,
            email,
            phone,
            source: 'learnmedicare-home',
            result,
          });
        } catch (err) {
          console.error('lead: failed to create disqualified-agent contact:', err);
        }
        return json({ ok: true, disqualified: true });
      }
    }
  }

  const payload = {
    first_name,
    last_name,
    email,
    phone,
    tag_base: 'learnmedicare-lead',
    tag_status,
    source: 'learnmedicare',
    // Passive geolocation via Cloudflare's edge header — no third-party API.
    detected_state: request.headers.get('CF-IPRegion') ?? (request as any).cf?.regionCode ?? '',
  };

  // Out-of-state geofencing — see _shared/visitorTargeting.ts. Soft signal
  // (CF-IPRegion is best-effort, VPNs can mismatch); current mode excludes
  // the lead from delivery without blocking page access or erroring to the
  // visitor.
  const targeting = checkVisitorTargeting(payload.detected_state);
  if (targeting.shouldExcludeFromLeadCapture) {
    return json({ ok: true, excluded: true });
  }

  if (!env.GHL_WEB_LEAD_WEBHOOK_URL) {
    return json({ ok: false, error: 'Lead delivery is not configured yet.' }, 500);
  }

  // Soft email-domain signal — only reached when NOT already disqualified
  // above, and skipped entirely under the kill switch. Never changes this
  // submission's flow; just leaves a note on the real contact for later
  // manual review. Fire-and-forget, non-blocking.
  if (!gateDisabled && env.GHL_API_TOKEN) {
    context.waitUntil(
      flagDomainSignalByEmail(env.GHL_API_TOKEN, { firstName: first_name, lastName: last_name, email, phone, occupation: body.occupation }),
    );
  }

  const delivered = await forwardToGHL(env.GHL_WEB_LEAD_WEBHOOK_URL, payload);
  if (!delivered) {
    return json({ ok: false, error: "We couldn't submit your request. Please try again or call us." }, 502);
  }

  return json({ ok: true });
};

export const onRequestGet: PagesFunction = async () =>
  new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
