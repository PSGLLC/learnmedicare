/// <reference types="@cloudflare/workers-types" />

// Shared insurance-agent disqualification logic used by every lead-capture
// endpoint that has the occupation field (t65-lead, otc-lookup-lead,
// route-web-lead, and the LearnMedicare/Partner-Portal equivalents build
// their own copy of this same logic, since each is a separate deployable).
//
// Two independent triggers, checked in this order (per Kayla's spec — the
// blocklist runs first, before anything else, regardless of occupation):
//   1. Known-individual blocklist: a GHL contact matching the submitted
//      email/phone that already carries the `blocklisted-agent` tag. Kayla
//      maintains this directly in GHL (create/find a contact, tag it) — no
//      code change or deploy needed to add an entry. Fails OPEN (treated as
//      "not blocklisted") on any lookup error, since this is a
//      defense-in-depth layer, not the only gate, and a GHL hiccup must
//      never block a real lead's submission.
//   2. Occupation self-identified as "Health/Medicare/Life Insurance Agent
//      or Broker" specifically — NOT P&C/auto/home agents or financial
//      advisors, who proceed through the normal lead flow unchanged (see
//      OCCUPATION_OPTIONS below).
//
// Either trigger produces the same outcome: a note appended to ONE shared
// "Blocked Agents Log" contact (not a new contact per flagged person) — no
// custom fields, no pipeline, no calendar/webinar-registration side effects
// on the flagged person's own identity, for manual review only. Callers must
// skip their normal lead-delivery path (webhook forward / full contact
// upsert) entirely when this fires — logging to the shared contact is the
// only GHL side effect that should happen for a disqualified submission.

// Kill switch — set the Cloudflare Pages env var/secret AGENT_GATE_DISABLED
// to "true" (via `wrangler pages secret put` or the dashboard) to make every
// endpoint using this module skip ALL of blocklist/occupation/domain-signal
// logic and fall straight back to the pre-existing "just create the lead"
// behavior, with no code revert or redeploy — Pages env vars/secrets are
// read at request time by the already-deployed Function, so flipping this
// takes effect on the next request, not the next deploy.
export function isGateDisabled(env: { AGENT_GATE_DISABLED?: string }): boolean {
  return env.AGENT_GATE_DISABLED === "true";
}

export const OCCUPATION_OPTIONS = [
  { value: "retired", label: "Retired" },
  { value: "self-employed", label: "Self-employed" },
  { value: "healthcare", label: "Healthcare" },
  { value: "insurance-medicare-life", label: "Health/Medicare/Life Insurance Agent or Broker" },
  // P&C/auto/home agents sell a non-competing product line — proceeds
  // through the normal lead flow like any other occupation.
  { value: "insurance-pc", label: "Property & Casualty / Auto / Home Insurance Agent" },
  // Intentionally NOT a reject trigger. Kayla may revisit this once
  // Prosperity Services Group launches — this is a deliberate neutral
  // choice for now, not a final decision either way.
  { value: "financial-advisor", label: "Financial Advisor / Wealth Management" },
  { value: "other", label: "Other" },
] as const;

export const REJECT_OCCUPATION_VALUE = "insurance-medicare-life";
export const BLOCKLIST_TAG = "blocklisted-agent";
export const DISQUALIFIED_TAG = "disqualified-agent";

export function occupationLabel(value: string): string {
  return OCCUPATION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

// Server-side enforcement that occupation is actually one of the defined
// options — required so a raw API call that skips the frontend's `required`
// dropdown attribute can't slip an empty/arbitrary value through and have it
// silently treated as "not an agent, proceed normally" by checkDisqualification.
export function isValidOccupation(value: unknown): value is string {
  return typeof value === "string" && OCCUPATION_OPTIONS.some((o) => o.value === value);
}

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const DEFAULT_LOCATION_ID = "RMrQyYPseTazGPmAynzT";

async function ghlFetch(token: string, path: string, init: RequestInit): Promise<Response> {
  return fetch(`${GHL_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
  });
}

async function isBlocklisted(
  token: string,
  locationId: string,
  input: { email?: string; phone?: string },
): Promise<boolean> {
  const term = input.email || input.phone;
  if (!term || !token) return false;
  try {
    const res = await ghlFetch(
      token,
      `/contacts/?locationId=${encodeURIComponent(locationId)}&query=${encodeURIComponent(term)}&limit=10`,
      { method: "GET" },
    );
    if (!res.ok) return false;
    const data: { contacts?: Array<{ tags?: string[] }> } = await res.json().catch(() => ({}));
    return (data.contacts ?? []).some((c) => Array.isArray(c.tags) && c.tags.includes(BLOCKLIST_TAG));
  } catch {
    return false; // fail open — see header comment
  }
}

export interface DisqualificationResult {
  disqualified: boolean;
  // "domain" (email-domain signal on a passthrough submission) is reserved
  // but not yet implemented anywhere — checkDisqualification never returns
  // it today. Added so the shared-contact note format and TypeScript types
  // don't need to change again once that mechanism is defined.
  trigger?: "blocklist" | "occupation" | "domain";
  occupationLabel?: string;
}

export async function checkDisqualification(
  token: string,
  input: { occupation?: string; email?: string; phone?: string },
  locationId: string = DEFAULT_LOCATION_ID,
): Promise<DisqualificationResult> {
  if (await isBlocklisted(token, locationId, input)) {
    return { disqualified: true, trigger: "blocklist" };
  }
  const occ = String(input.occupation ?? "");
  if (occ === REJECT_OCCUPATION_VALUE) {
    return { disqualified: true, trigger: "occupation", occupationLabel: occupationLabel(occ) };
  }
  return { disqualified: false };
}

// Fixed identity for the single shared log contact. GHL's /contacts/upsert
// is a native find-or-create keyed on email — POSTing this same email
// always resolves to the same contact, creating it once on the very first
// call and simply returning its id on every call after that. This is what
// makes "check if it exists before creating" a non-issue: there's no
// separate existence check to get racy, GHL's upsert already guarantees
// idempotency by email server-side.
const BLOCKED_AGENTS_LOG_EMAIL = "blocked-agents-log@internal.priceservicesgroup.com";
const BLOCKED_AGENTS_LOG_NAME = { firstName: "Blocked Agents", lastName: "Log" };

export interface DisqualifiedAgentInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  source: string; // e.g. "turning-65", "otc-benefits", "resources"
  result: DisqualificationResult;
}

function triggerLabel(result: DisqualificationResult): string {
  if (result.trigger === "blocklist") return "blocklist (known email/phone match)";
  if (result.trigger === "domain") return "email-domain signal";
  return `occupation (self-identified as ${result.occupationLabel})`;
}

export async function createDisqualifiedAgentContact(
  token: string,
  input: DisqualifiedAgentInput,
  locationId: string = DEFAULT_LOCATION_ID,
): Promise<void> {
  const upsertRes = await ghlFetch(token, "/contacts/upsert", {
    method: "POST",
    body: JSON.stringify({
      locationId,
      firstName: BLOCKED_AGENTS_LOG_NAME.firstName,
      lastName: BLOCKED_AGENTS_LOG_NAME.lastName,
      email: BLOCKED_AGENTS_LOG_EMAIL,
    }),
  });

  if (!upsertRes.ok) {
    throw new Error(`GHL upsert failed: ${upsertRes.status} ${await upsertRes.text().catch(() => "")}`);
  }

  const data: { contact?: { id?: string } } = await upsertRes.json().catch(() => ({}));
  const contactId = data.contact?.id;
  if (!contactId) throw new Error("GHL upsert returned no contact.id");

  // Idempotent — GHL doesn't duplicate a tag a contact already has, so this
  // is safe to send on every flagged submission rather than tracking
  // whether it's already tagged.
  await ghlFetch(token, `/contacts/${contactId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tags: [DISQUALIFIED_TAG] }),
  }).catch(() => undefined);

  const note = [
    `Flagged submission logged — mechanism: ${triggerLabel(input.result)}.`,
    `Source: ${input.source}.`,
    `Name: ${[input.firstName, input.lastName].filter(Boolean).join(" ") || "—"}.`,
    `Email: ${input.email || "—"}.`,
    `Phone: ${input.phone || "—"}.`,
    `Timestamp: ${new Date().toISOString()}.`,
  ].join(" ");

  await ghlFetch(token, `/contacts/${contactId}/notes`, {
    method: "POST",
    body: JSON.stringify({ body: note }),
  }).catch(() => undefined);
}

// --- Email-domain soft-flag signal ---------------------------------------
// Runs on every submission that was NOT already rejected by blocklist or
// occupation — i.e. the person proceeds through the normal lead flow
// unchanged, but if their email domain looks like an insurance/agency/
// financial-services company, a note AND the `domain-flagged` tag are added
// to THEIR OWN real contact record so Kayla's GHL workflow can alert on it,
// same as the Blocked Agents Log does for `disqualified-agent`. Not a
// disqualification: no Blocked Agents Log entry, no change to
// pipeline/calendar/offer access.

export const DOMAIN_FLAGGED_TAG = "domain-flagged";

const DOMAIN_SIGNAL_KEYWORDS = ["insurance", "agency", "agent", "financial", "wealth", "brokers", "advisors"];

// Never flagged even on a coincidental substring match (e.g. an
// "agentsmith@gmail.com" personal address) — these are free consumer
// providers, not a company's own domain.
const FREE_PROVIDER_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com"];

export function checkEmailDomainSignal(email?: string): { matches: boolean; domain: string } {
  const domain = String(email ?? "").split("@")[1]?.toLowerCase().trim() ?? "";
  if (!domain) return { matches: false, domain: "" };
  if (FREE_PROVIDER_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return { matches: false, domain };
  }
  return { matches: DOMAIN_SIGNAL_KEYWORDS.some((kw) => domain.includes(kw)), domain };
}

// For callers that already have the real contact's id from their normal
// (non-disqualified) lead-creation flow — e.g. otc-lookup-lead.ts,
// onboarding/submit.ts — this is the cheapest path: no extra upsert needed.
export async function flagDomainSignalOnContact(
  token: string,
  contactId: string,
  input: { domain: string; occupationLabel: string },
): Promise<void> {
  const note = `⚠️ Email domain pattern matches known insurance/agency naming (domain: ${input.domain}) — flagged for awareness. Occupation selected: ${input.occupationLabel}.`;
  await ghlFetch(token, `/contacts/${contactId}/notes`, {
    method: "POST",
    body: JSON.stringify({ body: note }),
  }).catch(() => undefined);
  // Idempotent — GHL doesn't duplicate a tag a contact already has.
  await ghlFetch(token, `/contacts/${contactId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tags: [DOMAIN_FLAGGED_TAG] }),
  }).catch(() => undefined);
}

// For callers on the webhook-forward pattern (t65-lead, route-web-lead, and
// LearnMedicare's course-lead/email-course-lead/lead) that never get a
// contactId back from GHL directly. Resolves the same real contact the
// webhook trigger creates/updates by upserting on the same email (GHL's
// upsert is idempotent by email — see createDisqualifiedAgentContact's
// header comment above), then attaches the note to it. Best-effort: any
// failure here must never affect the real lead's normal delivery.
export async function flagDomainSignalByEmail(
  token: string,
  input: { firstName: string; lastName: string; email?: string; phone?: string; occupation?: string },
  locationId: string = DEFAULT_LOCATION_ID,
): Promise<void> {
  const { matches, domain } = checkEmailDomainSignal(input.email);
  if (!matches || !token) return;
  try {
    const upsertRes = await ghlFetch(token, "/contacts/upsert", {
      method: "POST",
      body: JSON.stringify({
        locationId,
        firstName: input.firstName,
        lastName: input.lastName,
        ...(input.email ? { email: input.email } : {}),
        ...(input.phone ? { phone: input.phone } : {}),
      }),
    });
    if (!upsertRes.ok) return;
    const data: { contact?: { id?: string } } = await upsertRes.json().catch(() => ({}));
    const contactId = data.contact?.id;
    if (!contactId) return;
    await flagDomainSignalOnContact(token, contactId, {
      domain,
      occupationLabel: occupationLabel(String(input.occupation ?? "")),
    });
  } catch {
    // best-effort — see header comment
  }
}
