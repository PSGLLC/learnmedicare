// Cloudflare Pages Function backing the NPN lookup form on /agent-resources.
//
// IMPORTANT — this deliberately does NOT call the NPPES API
// (npiregistry.cms.hhs.gov) the original brief specified. NPPES is CMS's
// registry of healthcare providers' NPIs (National Provider Identifiers) —
// a completely different identifier system from an insurance agent's NPN
// (National Producer Number, tracked by NIPR / state Departments of
// Insurance, not CMS). Confirmed live: NPIs are strictly 10 digits; a real
// NPN like Kayla's (18530055) is 8 digits and isn't in NPPES's dataset at
// all. Calling NPPES with an NPN would return either a format error or,
// worse, silently match an unrelated healthcare provider's NPI that
// happens to share a numeric value. Instead, this returns a clear message
// pointing to NIPR (the actual national producer registry) and each
// state's DOI lookup — see agent-resources.astro for the client side.
// If a real NIPR API agreement is obtained later, this is the file to
// wire it into.

interface Env {
  AGENT_VERIFY_RATE_LIMIT?: KVNamespace;
}

const RATE_LIMIT = 10; // requests per IP per window
const RATE_WINDOW_MS = 60_000;

// Fallback in-memory limiter used when no KV namespace is bound (this repo
// has no wrangler.toml / KV provisioned as of writing — see the report for
// this batch). Module-scope state in a Pages Function is per-isolate and
// NOT shared across Cloudflare's edge locations or guaranteed to persist
// between invocations, so this is a best-effort deterrent against a single
// script hammering one edge node, not a real distributed rate limit. If
// KV is provisioned later (wrangler kv:namespace create, bound as
// AGENT_VERIFY_RATE_LIMIT), the code below prefers it automatically.
const memoryHits = new Map<string, number[]>();

async function isRateLimited(env: Env, ip: string): Promise<boolean> {
  const now = Date.now();
  if (env.AGENT_VERIFY_RATE_LIMIT) {
    const key = `agent-verify:${ip}`;
    const raw = await env.AGENT_VERIFY_RATE_LIMIT.get(key);
    const hits: number[] = raw ? JSON.parse(raw) : [];
    const recent = hits.filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length >= RATE_LIMIT) return true;
    recent.push(now);
    await env.AGENT_VERIFY_RATE_LIMIT.put(key, JSON.stringify(recent), { expirationTtl: 120 });
    return false;
  }
  const hits = memoryHits.get(ip) ?? [];
  const recent = hits.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    memoryHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  memoryHits.set(ip, recent);
  return false;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";

  if (await isRateLimited(env, ip)) {
    return json({ ok: false, error: "Too many requests. Please try again in a minute." }, 429);
  }

  const url = new URL(request.url);
  const npn = (url.searchParams.get("npn") ?? "").trim();

  if (!npn) {
    return json({ ok: false, error: "npn query param required." }, 400);
  }
  if (!/^\d{5,10}$/.test(npn)) {
    return json({ ok: false, error: "Enter a valid NPN (digits only)." }, 400);
  }

  return json({
    ok: false,
    unavailable: true,
    message:
      "Automated NPN verification isn't available here — NPNs are tracked by NIPR (the National Insurance Producer Registry) and state Departments of Insurance, not a public API this site can query directly.",
    links: [
      { label: "NIPR Producer Lookup (nipr.com)", url: "https://nipr.com" },
      { label: "NC DOI License Lookup", url: "https://www.ncdoi.gov" },
    ],
  });
};

export const onRequestPost: PagesFunction = async () =>
  new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET" } });
