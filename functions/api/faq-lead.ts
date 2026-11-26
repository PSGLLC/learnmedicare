interface D1Result { meta?: { changes?: number } }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<D1Result>;
  first<T>(): Promise<T | null>;
}
interface D1Database { prepare(sql: string): D1Statement }
interface Env {
  FAQ_GUIDE_REQUESTS?: D1Database;
  GHL_API_TOKEN?: string;
  FAQ_REQUEST_HASH_KEY?: string;
  FAQ_GUIDE_DELIVERY_MODE?: string;
  FAQ_GUIDE_TEST_RECIPIENT?: string;
  FAQ_GHL_SENDER_BEHAVIOR_CONFIRMED?: string;
  FAQ_GHL_CONTACT_CREATION_ENABLED?: string;
  FAQ_GHL_CONTACT_CREATED_EFFECTS_APPROVED?: string;
}
interface LeadPayload {
  firstName?: string;
  email?: string;
  website?: string;
  requestId?: string;
}
interface GhlContact {
  id?: string;
  locationId?: string;
  email?: string;
  emailLowerCase?: string;
  firstName?: string;
  dnd?: boolean;
  dndSettings?: { email?: { status?: string } };
  additionalEmails?: Array<{ email?: string }>;
}

const LOCATION_ID = "RMrQyYPseTazGPmAynzT";
const GHL_API = "https://services.leadconnectorhq.com";
const FAQ_ORIGIN = "https://learnmedicare.org";
const GUIDE_URL = "https://learnmedicare.org/medicare-at-65-guide/";
const PDF_URL = "https://learnmedicare.org/docs/T65-Medicare-Guide.pdf";
const EMAIL_FROM = "info@priceservicesgroup.com";
// The GHL send API does not document From-name or Reply-To input fields.
// Live mode stays off until the connected Private Email provider is verified
// to apply the owner's saved Kayla Price / Reply-To configuration.
const EMAIL_SUBJECT = "Your requested 2027 Medicare at 65 guide";
const TEST_EMAIL_SUBJECT = "TEST — Your requested 2027 Medicare at 65 guide";
const REQUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RETENTION_SECONDS = 90 * 24 * 60 * 60;
const MAX_LOOKUP_PAGES = 25;
const RATE_LIMITS = { recipientDay: 3, ipHour: 10, globalDay: 50 };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function unavailable(): Response {
  return json({ ok: false, status: "unavailable", error: "One-time guide requests are temporarily unavailable. You can still read or download the guide, or contact us for help.", guideUrl: GUIDE_URL, pdfUrl: PDF_URL }, 503);
}

function safeResponseForOutcome(outcome: string | undefined): Response {
  if (outcome === "queued") return json({ ok: true, status: "queued", emailDelivered: false, duplicate: true });
  if (outcome === "ambiguous") return json({ ok: false, status: "delivery_unconfirmed", error: "We could not confirm what happened to this request. Please do not submit it again yet; contact us if you still need the guide." }, 502);
  if (outcome === "processing") return json({ ok: false, status: "already_processing", error: "This request is already being processed. Please wait before trying again." }, 409);
  if (outcome === "multiple_matches") return json({ ok: false, status: "recipient_needs_help", error: "We could not safely match this request to one email recipient. Please contact us for help. You can still read or download the guide.", guideUrl: GUIDE_URL, pdfUrl: PDF_URL }, 200);
  if (outcome === "no_match") return json({ ok: false, status: "recipient_needs_help", error: "We could not safely match this request to an existing email recipient. Please contact us for help. You can still read or download the guide.", guideUrl: GUIDE_URL, pdfUrl: PDF_URL }, 200);
  if (outcome === "email_suppressed") return json({ ok: false, status: "recipient_needs_help", error: "We could not send this request to the matched contact. Please contact us for help. You can still read or download the guide.", guideUrl: GUIDE_URL, pdfUrl: PDF_URL }, 200);
  if (outcome === "rate_limited") return json({ ok: false, status: "rate_limited", error: "Too many guide requests were made recently. Please wait and try again later. You can still read or download the guide.", guideUrl: GUIDE_URL, pdfUrl: PDF_URL }, 429);
  return unavailable();
}

function isUniqueViolation(error: unknown): boolean {
  return String(error).toLowerCase().includes("unique") || String(error).toLowerCase().includes("constraint");
}

async function digest(key: string, value: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function acquireRateLimit(db: D1Database, scope: string, keyHash: string, bucketStart: number, maximum: number): Promise<boolean> {
  const row = await db.prepare(
    "INSERT INTO faq_guide_rate_limits (scope, key_hash, bucket_start, count) VALUES (?, ?, ?, 1) ON CONFLICT(scope, key_hash, bucket_start) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count",
  ).bind(scope, keyHash, bucketStart, maximum).first<{ count: number }>();
  return row !== null;
}

async function setOutcome(db: D1Database, requestId: string, status: "accepted" | "ambiguous", outcome: string, providerMessageId?: string): Promise<void> {
  await db.prepare("UPDATE faq_guide_requests SET status = ?, outcome = ?, provider_message_id = COALESCE(?, provider_message_id), updated_at = unixepoch() WHERE request_id = ? AND status = 'processing'")
    .bind(status, outcome, providerMessageId ?? null, requestId).run();
}

async function findByRequestId(db: D1Database, requestId: string): Promise<{ outcome: string } | null> {
  return db.prepare("SELECT outcome FROM faq_guide_requests WHERE request_id = ?").bind(requestId).first<{ outcome: string }>();
}

async function findActiveRecipient(db: D1Database, recipientKey: string): Promise<{ status: string; outcome: string } | null> {
  return db.prepare("SELECT status, outcome FROM faq_guide_requests WHERE recipient_hash = ? AND status IN ('processing', 'ambiguous') LIMIT 1")
    .bind(recipientKey).first<{ status: string; outcome: string }>();
}

function exactEmailMatch(contact: GhlContact, normalizedEmail: string): boolean {
  const primary = (contact.emailLowerCase ?? contact.email ?? "").trim().toLowerCase();
  const additional = (contact.additionalEmails ?? []).some(item => (item.email ?? "").trim().toLowerCase() === normalizedEmail);
  return primary === normalizedEmail || additional;
}

async function lookupContacts(email: string, token: string): Promise<{ contacts: GhlContact[]; complete: boolean }> {
  const exactById = new Map<string, GhlContact>();
  let cursor: string | undefined;
  const cursors = new Set<string>();
  for (let page = 0; page < MAX_LOOKUP_PAGES; page += 1) {
    const url = new URL(`${GHL_API}/contacts/lookup`);
    url.searchParams.set("locationId", LOCATION_ID);
    url.searchParams.set("email", email);
    url.searchParams.set("limit", "20");
    if (cursor) url.searchParams.set("nextCursor", cursor);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Version: "v3", Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`lookup_http_${response.status}`);
    const body = await response.json() as { contacts?: GhlContact[]; nextCursor?: string };
    for (const contact of body.contacts ?? []) {
      if (contact.id && contact.locationId === LOCATION_ID && exactEmailMatch(contact, email)) exactById.set(contact.id, contact);
    }
    if (exactById.size > 1) return { contacts: [...exactById.values()], complete: true };
    if (!body.nextCursor) return { contacts: [...exactById.values()], complete: true };
    if (cursors.has(body.nextCursor)) return { contacts: [...exactById.values()], complete: false };
    cursors.add(body.nextCursor);
    cursor = body.nextCursor;
  }
  return { contacts: [...exactById.values()], complete: false };
}

async function createMinimalContact(email: string, firstName: string, token: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${GHL_API}/contacts/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Version: "v3", "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ locationId: LOCATION_ID, email, firstName, source: "learnmedicare-faq-page" }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new Error("create_contact_ambiguous_transport");
  }
  if (!response.ok) throw new Error(`create_contact_http_${response.status}`);
  let result: { contact?: { id?: string }; id?: string };
  try { result = await response.json() as typeof result; } catch { throw new Error("create_contact_ambiguous_response"); }
  const contactId = result.contact?.id ?? result.id;
  if (!contactId) throw new Error("create_contact_ambiguous_missing_id");
  return contactId;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function emailHtml(firstName: string): string {
  const greeting = firstName ? `Hello ${escapeHtml(firstName)},` : "Hello there,";
  return `<p>${greeting}</p>
<p>Here is the 2027 Medicare at 65 guide you requested. <a href="${GUIDE_URL}">Read the source-linked guide online</a> or <a href="${PDF_URL}">download the printable PDF</a>.</p>
<p>The guide separates 2027 amounts from enrollment dates and explains where to confirm plan-specific details with Medicare, CMS, Social Security, VA, or TRICARE. The 2027 federal amounts take effect January 1, 2027; CMS announced them November 17, 2026.</p>
<p>This is a one-time response to your guide request. It does not sign you up for ongoing marketing, calls, or text messages. If this request was not yours, you can ignore this email.</p>
<p>Learn Medicare / Price Services Group</p>`;
}

function emailText(firstName: string): string {
  const greeting = firstName ? `Hello ${firstName},` : "Hello there,";
  return `${greeting}\n\nHere is the 2027 Medicare at 65 guide you requested. Read the source-linked guide online: ${GUIDE_URL} or download the printable PDF: ${PDF_URL}.\n\nThe guide separates 2027 amounts from enrollment dates and explains where to confirm plan-specific details with Medicare, CMS, Social Security, VA, or TRICARE. The 2027 federal amounts take effect January 1, 2027; CMS announced them November 17, 2026.\n\nThis is a one-time response to your guide request. It does not sign you up for ongoing marketing, calls, or text messages. If this request was not yours, you can ignore this email.\n\nLearn Medicare / Price Services Group`;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Mode defaults to off. Test mode can send only to the one configured test
  // recipient; live mode additionally requires sender/provider behavior review.
  const mode = env.FAQ_GUIDE_DELIVERY_MODE ?? "off";
  if (!(["test", "live"].includes(mode))) return unavailable();
  if (mode === "live" && env.FAQ_GHL_SENDER_BEHAVIOR_CONFIRMED !== "true") return unavailable();
  if (request.headers.get("origin") !== FAQ_ORIGIN) return json({ ok: false, error: "This request is not available from this page." }, 403);
  if (!env.FAQ_GUIDE_REQUESTS || !env.GHL_API_TOKEN || !env.FAQ_REQUEST_HASH_KEY) return unavailable();
  if (env.FAQ_REQUEST_HASH_KEY.length < 32) return unavailable();
  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > 4096)) return json({ ok: false, error: "Request is too large." }, 413);
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return json({ ok: false, error: "Expected application/json." }, 415);

  let body: LeadPayload;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 4096) return json({ ok: false, error: "Request is too large." }, 413);
    body = JSON.parse(raw) as LeadPayload;
  } catch { return json({ ok: false, error: "Invalid JSON." }, 400); }
  if (body.website) return json({ ok: true });

  const firstName = String(body.firstName ?? "").trim().slice(0, 80);
  const email = String(body.email ?? "").trim().toLowerCase();
  const requestId = String(body.requestId ?? "").trim();
  if (!firstName || !email) return json({ ok: false, error: "First name and email are required." }, 400);
  if (email.length > 254 || !EMAIL_RE.test(email)) return json({ ok: false, error: "Enter a valid email address." }, 400);
  if (mode === "test" && (!env.FAQ_GUIDE_TEST_RECIPIENT || email !== env.FAQ_GUIDE_TEST_RECIPIENT.trim().toLowerCase())) return unavailable();
  if (!REQUEST_ID_RE.test(requestId)) return json({ ok: false, error: "Refresh the page and try again." }, 400);

  const db = env.FAQ_GUIDE_REQUESTS;
  const ipAddress = request.headers.get("cf-connecting-ip")?.trim();
  if (!ipAddress) return unavailable();
  let recipientKey: string;
  let ipKey: string;
  try {
    [recipientKey, ipKey] = await Promise.all([
      digest(env.FAQ_REQUEST_HASH_KEY, `email:${email}`),
      digest(env.FAQ_REQUEST_HASH_KEY, `ip:${ipAddress}`),
    ]);
    const now = Math.floor(Date.now() / 1000);
    await db.prepare("DELETE FROM faq_guide_requests WHERE created_at < ?").bind(now - RETENTION_SECONDS).run();
    await db.prepare("DELETE FROM faq_guide_rate_limits WHERE bucket_start < ?").bind(now - 2 * 24 * 60 * 60).run();
    await db.prepare("INSERT INTO faq_guide_requests (request_id, status, created_at, updated_at, recipient_hash, ip_hash, outcome) VALUES (?, 'processing', unixepoch(), unixepoch(), ?, ?, 'processing')")
      .bind(requestId, recipientKey, ipKey).run();
  } catch (error) {
    if (!isUniqueViolation(error)) return unavailable();
    try {
      const existing = await findByRequestId(db, requestId);
      if (existing) return safeResponseForOutcome(existing.outcome);
      const active = await findActiveRecipient(db, recipientKey!);
      if (active) return safeResponseForOutcome(active.outcome);
    } catch { /* fail closed below */ }
    return unavailable();
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const recipientAllowed = await acquireRateLimit(db, "recipient_day", recipientKey, Math.floor(now / 86_400) * 86_400, mode === "test" ? 1 : RATE_LIMITS.recipientDay);
    const ipAllowed = recipientAllowed && await acquireRateLimit(db, "ip_hour", ipKey, Math.floor(now / 3_600) * 3_600, RATE_LIMITS.ipHour);
    const globalKey = await digest(env.FAQ_REQUEST_HASH_KEY, "global:faq-guide-fulfillment");
    const globalAllowed = recipientAllowed && ipAllowed && await acquireRateLimit(db, "global_day", globalKey, Math.floor(now / 86_400) * 86_400, mode === "test" ? 1 : RATE_LIMITS.globalDay);
    if (!recipientAllowed || !ipAllowed || !globalAllowed) {
      await setOutcome(db, requestId, "accepted", "rate_limited");
      return safeResponseForOutcome("rate_limited");
    }
  } catch {
    await setOutcome(db, requestId, "accepted", "configuration_error").catch(() => undefined);
    return unavailable();
  }

  let lookup: { contacts: GhlContact[]; complete: boolean };
  try {
    lookup = await lookupContacts(email, env.GHL_API_TOKEN);
  } catch {
    await setOutcome(db, requestId, "accepted", "lookup_failed").catch(() => undefined);
    return unavailable();
  }
  if (!lookup.complete) {
    await setOutcome(db, requestId, "accepted", "lookup_incomplete").catch(() => undefined);
    return unavailable();
  }
  if (lookup.contacts.length > 1) {
    await setOutcome(db, requestId, "accepted", "multiple_matches").catch(() => undefined);
    return safeResponseForOutcome("multiple_matches");
  }

  let contactId: string;
  let recipientName: string;
  let alternateRecipientEmail: string | undefined;
  if (lookup.contacts.length === 0) {
    if (mode !== "live" || env.FAQ_GHL_CONTACT_CREATION_ENABLED !== "true" || env.FAQ_GHL_CONTACT_CREATED_EFFECTS_APPROVED !== "true") {
      await setOutcome(db, requestId, "accepted", "no_match").catch(() => undefined);
      return safeResponseForOutcome("no_match");
    }
    try {
      contactId = await createMinimalContact(email, firstName, env.GHL_API_TOKEN);
      recipientName = firstName;
    } catch (error) {
      const ambiguous = /AbortError|timeout|network|fetch failed|ambiguous_|create_contact_http_(?:429|5\d\d)/i.test(String(error));
      await setOutcome(db, requestId, ambiguous ? "ambiguous" : "accepted", ambiguous ? "ambiguous" : "contact_creation_failed").catch(() => undefined);
      return safeResponseForOutcome(ambiguous ? "ambiguous" : "no_match");
    }
  } else {
    const matched = lookup.contacts[0];
    if (matched.dnd === true || ["active", "permanent"].includes((matched.dndSettings?.email?.status ?? "").toLowerCase())) {
      await setOutcome(db, requestId, "accepted", "email_suppressed").catch(() => undefined);
      return safeResponseForOutcome("email_suppressed");
    }
    contactId = matched.id!;
    recipientName = String(matched.firstName ?? "").trim().slice(0, 80);
    const primaryEmail = (matched.emailLowerCase ?? matched.email ?? "").trim().toLowerCase();
    if (primaryEmail !== email) alternateRecipientEmail = email;
  }

  let sent: Response;
  try {
    sent = await fetch(`${GHL_API}/conversations/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GHL_API_TOKEN}`, Version: "v3", "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ type: "Email", contactId, ...(alternateRecipientEmail ? { emailTo: alternateRecipientEmail } : {}), emailFrom: EMAIL_FROM, subject: mode === "test" ? TEST_EMAIL_SUBJECT : EMAIL_SUBJECT, html: emailHtml(recipientName), message: emailText(recipientName), status: "pending" }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    await setOutcome(db, requestId, "ambiguous", "ambiguous").catch(() => undefined);
    return safeResponseForOutcome("ambiguous");
  }
  if (!sent.ok) {
    if (sent.status >= 500 || sent.status === 429) {
      await setOutcome(db, requestId, "ambiguous", "ambiguous").catch(() => undefined);
      return safeResponseForOutcome("ambiguous");
    }
    await setOutcome(db, requestId, "accepted", "send_rejected").catch(() => undefined);
    return unavailable();
  }

  let providerResponse: { messageId?: string; emailMessageId?: string };
  try { providerResponse = await sent.json() as typeof providerResponse; } catch {
    await setOutcome(db, requestId, "ambiguous", "ambiguous").catch(() => undefined);
    return safeResponseForOutcome("ambiguous");
  }
  if (!providerResponse.messageId && !providerResponse.emailMessageId) {
    await setOutcome(db, requestId, "ambiguous", "ambiguous").catch(() => undefined);
    return safeResponseForOutcome("ambiguous");
  }

  const providerMessageId = providerResponse.messageId ?? providerResponse.emailMessageId;
  await setOutcome(db, requestId, "accepted", "queued", providerMessageId).catch(() => undefined);
  return json({ ok: true, status: "queued", emailDelivered: false });
};

export const onRequestGet: PagesFunction = async () =>
  new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
