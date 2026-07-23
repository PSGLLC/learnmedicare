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

interface Env {
  GHL_WEB_LEAD_WEBHOOK_URL: string;
}

interface LeadPayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status?: string; // dropdown value, mapped to tag_status
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

  const payload = {
    first_name,
    last_name,
    email,
    phone,
    tag_base: 'learnmedicare-lead',
    tag_status,
    source: 'learnmedicare',
  };

  if (!env.GHL_WEB_LEAD_WEBHOOK_URL) {
    return json({ ok: false, error: 'Lead delivery is not configured yet.' }, 500);
  }

  const delivered = await forwardToGHL(env.GHL_WEB_LEAD_WEBHOOK_URL, payload);
  if (!delivered) {
    return json({ ok: false, error: "We couldn't submit your request. Please try again or call us." }, 502);
  }

  return json({ ok: true });
};

export const onRequestGet: PagesFunction = async () =>
  new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
