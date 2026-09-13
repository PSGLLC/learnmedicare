// Cloudflare Pages Function — owns delivery for the /course lead capture form.
// Browser POST → this function → GHL inbound webhook (success criterion)
//
// Mirrors functions/api/guide-lead.ts, trimmed to the first name + email
// fields collected on the /course page's lead form.

import { checkDisqualification, createDisqualifiedAgentContact, isValidOccupation, flagDomainSignalByEmail, isGateDisabled } from "./_shared/agentDisqualification";
import { checkVisitorTargeting } from "./_shared/visitorTargeting";

interface Env {
  GHL_GUIDE_WEBHOOK_URL: string;
  GHL_API_TOKEN: string;
  AGENT_GATE_DISABLED?: string;
}

interface LeadPayload {
  firstName?: string;
  email?: string;
  occupation?: string;
  source?: string; // "course-lead-form" | "vl-gate-form" — which form on /course posted here
  pagePath?: string;
  website?: string; // honeypot — real visitors never fill this
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GHL location this lead belongs to (Price Services Group LLC).
const GHL_LOCATION_ID = "RMrQyYPseTazGPmAynzT";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function forwardToGHL(webhookUrl: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return json({ ok: false, error: "Expected application/json." }, 415);
  }

  let body: LeadPayload;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON." }, 400);
  }

  // Honeypot tripped — pretend success, drop it silently. Don't tip off bots.
  if (body.website) {
    return json({ ok: true });
  }

  const firstName = String(body.firstName ?? "").trim();
  const email = String(body.email ?? "").trim();

  if (!firstName || !email) {
    return json({ ok: false, error: "First name and email are required." }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: "Enter a valid email address." }, 400);
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
      return json({ ok: false, error: "Select your occupation." }, 400);
    }
  }

  const formSource = String(body.source ?? "course-lead-form");

  if (!gateDisabled && env.GHL_API_TOKEN) {
    // Blocklist check (known individual) then occupation check — reject
    // before the normal webhook-forward flow below ever fires (that's what
    // creates the full GHL contact). Only a minimal throwaway contact is
    // created, for visibility, not follow-up.
    const result = await checkDisqualification(env.GHL_API_TOKEN, { occupation: body.occupation, email });
    if (result.disqualified) {
      try {
        await createDisqualifiedAgentContact(env.GHL_API_TOKEN, {
          firstName,
          lastName: "",
          email,
          source: formSource,
          result,
        });
      } catch (err) {
        console.error("course-lead: failed to create disqualified-agent contact:", err);
      }
      return json({ ok: true, disqualified: true });
    }
  }

  const submittedAt = new Date().toISOString();
  const payload = {
    firstName,
    email,
    locationId: GHL_LOCATION_ID,
    tags: ["learnmedicare-course-lead"],
    source: formSource,
    pagePath: String(body.pagePath ?? "/course"),
    submittedAt,
    // Passive geolocation via Cloudflare's edge header — no third-party API.
    detected_state: request.headers.get("CF-IPRegion") ?? "",
  };

  // Out-of-state geofencing — see _shared/visitorTargeting.ts. Soft signal
  // (CF-IPRegion is best-effort, VPNs can mismatch); current mode excludes
  // the lead from delivery without blocking page access or erroring to the
  // visitor.
  const targeting = checkVisitorTargeting(payload.detected_state);
  if (targeting.shouldExcludeFromLeadCapture) {
    return json({ ok: true, excluded: true });
  }

  if (!env.GHL_GUIDE_WEBHOOK_URL) {
    return json({ ok: false, error: "Lead delivery is not configured yet." }, 500);
  }

  // Soft email-domain signal — only reached when NOT already disqualified
  // above, and skipped entirely under the kill switch. Never changes this
  // submission's flow; just leaves a note on the real contact for later
  // manual review. Fire-and-forget, non-blocking.
  if (!gateDisabled && env.GHL_API_TOKEN) {
    context.waitUntil(
      flagDomainSignalByEmail(env.GHL_API_TOKEN, { firstName, lastName: "", email, occupation: body.occupation }),
    );
  }

  const delivered = await forwardToGHL(env.GHL_GUIDE_WEBHOOK_URL, payload);
  if (!delivered) {
    return json({ ok: false, error: "We couldn't submit your request. Please try again or call us." }, 502);
  }

  return json({ ok: true });
};

export const onRequestGet: PagesFunction = async () =>
  new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
