// Cloudflare Pages Function — owns delivery for the /guide lead capture form.
// Browser POST → this function → GHL inbound webhook (success criterion)
//
// Mirrors the pattern in PSGLLC/PSG-Main-Website's functions/api/t65-lead.ts
// and functions/api/agent-recruit-lead.ts: this site is an Astro "static"
// build with no SSR adapter. Cloudflare Pages picks up /functions/** on top
// of the static output, so this ships one dynamic endpoint without
// converting the whole site to server rendering. Keeping the GHL webhook URL
// server-side (env secret) instead of calling GHL directly from the browser
// keeps it off the client.

interface Env {
  GHL_GUIDE_WEBHOOK_URL: string;
}

interface LeadPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  pagePath?: string;
  website?: string; // honeypot — real visitors never fill this
  smsOptIn?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s()+\-.]{7,20}$/;

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
  const lastName = String(body.lastName ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();

  const smsOptIn = body.smsOptIn === true;

  if (!firstName || !lastName || !email) {
    return json({ ok: false, error: "First name, last name, and email are required." }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: "Enter a valid email address." }, 400);
  }
  if (phone && !PHONE_RE.test(phone)) {
    return json({ ok: false, error: "Enter a valid phone number." }, 400);
  }
  if (!smsOptIn) {
    return json({ ok: false, error: "SMS opt-in consent is required." }, 400);
  }

  const submittedAt = new Date().toISOString();
  const payload = {
    firstName,
    lastName,
    email,
    phone,
    locationId: GHL_LOCATION_ID,
    tags: ["t65-guide-request"],
    source: "learnmedicare-guide-page",
    pagePath: String(body.pagePath ?? "/guide"),
    smsOptIn,
    submittedAt,
  };

  if (!env.GHL_GUIDE_WEBHOOK_URL) {
    return json({ ok: false, error: "Lead delivery is not configured yet." }, 500);
  }

  const delivered = await forwardToGHL(env.GHL_GUIDE_WEBHOOK_URL, payload);
  if (!delivered) {
    return json({ ok: false, error: "We couldn't submit your request. Please try again or call us." }, 502);
  }

  return json({ ok: true });
};

export const onRequestGet: PagesFunction = async () =>
  new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
