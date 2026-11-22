// FAQ guide requests use a dedicated, approval-gated delivery path. This must
// not share the general guide/course webhook or the unrelated nurture flow.
interface D1Result { meta?: { changes?: number } }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<D1Result>;
  first<T>(): Promise<T | null>;
}
interface D1Database { prepare(sql: string): D1Statement }
interface Env {
  FAQ_GUIDE_REQUESTS?: D1Database;
  GHL_FAQ_GUIDE_WEBHOOK_URL?: string;
}

interface LeadPayload {
  firstName?: string;
  email?: string;
  pagePath?: string;
  website?: string; // honeypot — real visitors never fill this
  requestId?: string;
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

const REQUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RETENTION_SECONDS = 90 * 24 * 60 * 60;

function requestStatus(status: string | undefined): Response {
  if (status === "accepted") return json({ ok: true, deliveryStatus: "accepted", duplicate: true });
  if (status === "processing") return json({ ok: false, status: "already_processing", error: "This request is already being processed. Please wait before trying again." }, 409);
  return json({ ok: false, status: "delivery_unconfirmed", error: "We could not confirm what happened to this request. Please do not submit it again yet; contact us if you still need the guide." }, 502);
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
  const requestId = String(body.requestId ?? "").trim();

  if (!firstName || !email) {
    return json({ ok: false, error: "First name and email are required." }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: "Enter a valid email address." }, 400);
  }
  if (!REQUEST_ID_RE.test(requestId)) {
    return json({ ok: false, error: "Refresh the page and try again." }, 400);
  }

  const submittedAt = new Date().toISOString();
  const payload = {
    firstName,
    email,
    locationId: GHL_LOCATION_ID,
    // This tag is source attribution only; the dedicated workflow must not
    // add the separate learnmedicare-lead or email-drip-day1 nurture tags.
    tags: ["learnmedicare-faq-lead"],
    source: "learnmedicare-faq-page",
    pagePath: "/faq/",
    submittedAt,
  };
  const db = env.FAQ_GUIDE_REQUESTS;
  const webhookUrl = env.GHL_FAQ_GUIDE_WEBHOOK_URL;
  if (!db || !webhookUrl) {
    return json({ ok: false, error: "Guide requests are temporarily unavailable. Please contact us for the guide." }, 503);
  }

  // Retain only an opaque request key and state, never the inquiry or email.
  try {
    await db.prepare("DELETE FROM faq_guide_requests WHERE created_at < ?")
      .bind(Math.floor(Date.now() / 1000) - RETENTION_SECONDS).run();
    const claim = await db.prepare(
      "INSERT INTO faq_guide_requests (request_id, status, created_at, updated_at) VALUES (?, 'processing', unixepoch(), unixepoch()) ON CONFLICT(request_id) DO NOTHING",
    ).bind(requestId).run();
    if (claim.meta?.changes !== 1) {
      const existing = await db.prepare("SELECT status FROM faq_guide_requests WHERE request_id = ?")
        .bind(requestId).first<{ status: string }>();
      return requestStatus(existing?.status);
    }
  } catch {
    // Missing binding/table or storage errors must fail closed before any CRM write.
    return json({ ok: false, error: "Guide requests are temporarily unavailable. Please contact us for the guide." }, 503);
  }

  let accepted = false;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, requestId, requestType: "one-time-educational-guide" }),
      signal: AbortSignal.timeout(8_000),
    });
    accepted = res.ok;
  } catch {
    // The provider may have accepted a write before the connection failed.
    // Mark ambiguous and never replay this request ID automatically.
  }

  try {
    await db.prepare("UPDATE faq_guide_requests SET status = ?, updated_at = unixepoch() WHERE request_id = ? AND status = 'processing'")
      .bind(accepted ? "accepted" : "ambiguous", requestId).run();
  } catch {
    // A retry still sees the processing claim and will not repeat the provider write.
  }

  if (!accepted) {
    return json({ ok: false, status: "delivery_unconfirmed", error: "We could not confirm what happened to this request. Please do not submit it again yet; contact us if you still need the guide." }, 502);
  }

  // A webhook 2xx confirms workflow acceptance only, never email delivery.
  return json({ ok: true, deliveryStatus: "accepted", emailDelivered: false });
};

export const onRequestGet: PagesFunction = async () =>
  new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
