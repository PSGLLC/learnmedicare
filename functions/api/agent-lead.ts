// Cloudflare Pages Function — owns delivery for the /agent-resources
// interest-capture form. Browser POST → this function → GHL inbound webhook.
// Mirrors functions/api/faq-lead.ts, with an added NPN field.

interface Env {
  GHL_GUIDE_WEBHOOK_URL: string;
}

interface LeadPayload {
  name?: string;
  email?: string;
  npn?: string;
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

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const npn = String(body.npn ?? "").trim();

  if (!name || !email) {
    return json({ ok: false, error: "Name and email are required." }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: "Enter a valid email address." }, 400);
  }

  const submittedAt = new Date().toISOString();
  const payload = {
    name,
    email,
    npn: npn || undefined,
    locationId: GHL_LOCATION_ID,
    tags: ["learnmedicare-agent-resources-lead"],
    source: "learnmedicare-agent-resources-page",
    pagePath: String(body.pagePath ?? "/agent-resources"),
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
