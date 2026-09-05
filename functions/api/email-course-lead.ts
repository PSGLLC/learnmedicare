// Cloudflare Pages Function — owns delivery for the "Take the Email Course
// Instead" opt-in form on /course (Feature 9). Browser POST → this function
// → GHL inbound webhook.
//
// Mirrors functions/api/lead.ts (same GHL_WEB_LEAD_WEBHOOK_URL env secret,
// same tag_base/tag_status/source payload shape) rather than the
// GHL_GUIDE_WEBHOOK_URL used by guide-lead.ts/course-lead.ts/faq-lead.ts —
// this is a distinct lead type (email-course enrollment, not a one-time
// guide download) so it gets its own tag_base/tag_status for GHL workflow
// targeting. Does not call GHL directly beyond this existing
// webhook-forward pattern; workflow creation is out of scope here.

import { checkDisqualification, createDisqualifiedAgentContact, isValidOccupation, flagDomainSignalByEmail, isGateDisabled } from './_shared/agentDisqualification';

interface Env {
  GHL_WEB_LEAD_WEBHOOK_URL: string;
  GHL_API_TOKEN: string;
  AGENT_GATE_DISABLED?: string;
}

interface LeadPayload {
  first_name?: string;
  email?: string;
  occupation?: string;
  pagePath?: string;
  website?: string; // honeypot — real visitors never fill this
  tcpaConsent?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const email = String(body.email ?? '').trim();

  if (!first_name || !email) {
    return json({ ok: false, error: 'First name and email are required.' }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'Enter a valid email address.' }, 400);
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
      const result = await checkDisqualification(env.GHL_API_TOKEN, { occupation: body.occupation, email });
      if (result.disqualified) {
        try {
          await createDisqualifiedAgentContact(env.GHL_API_TOKEN, {
            firstName: first_name,
            lastName: '',
            email,
            source: 'email-course-form',
            result,
          });
        } catch (err) {
          console.error('email-course-lead: failed to create disqualified-agent contact:', err);
        }
        return json({ ok: true, disqualified: true });
      }
    }
  }

  // Note: no CF-IPRegion/detected_state field here — that signal isn't
  // wired up anywhere else on this site (checked functions/api/*.ts before
  // adding this endpoint), so it isn't fabricated here either.
  const payload = {
    first_name,
    email,
    tag_base: 'learnmedicare-email-course',
    tag_status: 'email-course-enrolled',
    source: 'learnmedicare-email-course',
    pagePath: String(body.pagePath ?? '/course'),
  };

  if (!env.GHL_WEB_LEAD_WEBHOOK_URL) {
    return json({ ok: false, error: 'Lead delivery is not configured yet.' }, 500);
  }

  // Soft email-domain signal — only reached when NOT already disqualified
  // above, and skipped entirely under the kill switch. Never changes this
  // submission's flow; just leaves a note on the real contact for later
  // manual review. Fire-and-forget, non-blocking.
  if (!gateDisabled && env.GHL_API_TOKEN) {
    context.waitUntil(
      flagDomainSignalByEmail(env.GHL_API_TOKEN, { firstName: first_name, lastName: '', email, occupation: body.occupation }),
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
