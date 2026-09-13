// Single source of truth for PSG's 10-state licensed footprint and for
// whether/how out-of-state web visitors are excluded from active
// marketing (lead-capture forms) on learnmedicare.org, per the Sept 2026
// geofencing scoping investigation. Mirrors PSG-Main-Website's
// functions/api/_shared/visitorTargeting.ts and Ambrose's
// src/lib/visitorTargeting.ts — kept as separate per-repo copies since each
// site is a separate deployable with no shared package between them; if
// the 10-state list ever changes, update all three.
//
// CMS TPMO rules don't mandate blocking site access by visitor location;
// this is a voluntary risk-reduction control, not a hard legal gate, hence
// the soft/adjustable design below.

// Licensed states — do not add TN or CA.
export const LICENSED_STATES = new Set([
  "NC", "SC", "GA", "FL", "VA", "MD", "MI", "KS", "TX", "OH",
]);

// --- Adjustable behavior for out-of-state lead-capture submissions ------
// Change this one constant to change what happens sitewide — no other
// code needs to change. Options:
//   "off"                  — no active behavior change; leads are still
//                            forwarded to GHL as today.
//   "exclude-lead-capture" — the submission is accepted from the visitor's
//                            point of view (still gets a normal success
//                            response) but is NOT forwarded to GHL, so no
//                            lead/contact is created and no follow-up
//                            marketing is triggered. Page access and CTA
//                            visibility are unaffected.
//   "hide-cta"              — reserved for a future client-side control
//                            (would hide the form/CTA entirely for
//                            out-of-state visitors); not implemented by
//                            this server-side check on its own.
// Default is "exclude-lead-capture" — the least disruptive option that
// still satisfies "don't actively market to out-of-state visitors."
export type TargetingMode = "off" | "exclude-lead-capture" | "hide-cta";
export const TARGETING_MODE: TargetingMode = "exclude-lead-capture";

export interface VisitorTargetingResult {
  region: string | null;
  inLicensedState: boolean;
  shouldExcludeFromLeadCapture: boolean;
}

// `region` should be the raw CF-IPRegion header value. Caveat: this is
// Cloudflare's best-effort edge geolocation — same accuracy tier as city-
// level lookups, and a VPN/proxy can cause a mismatch. Treat this as a
// soft targeting signal, never as proof of a visitor's real location.
export function checkVisitorTargeting(region: string | null | undefined): VisitorTargetingResult {
  const normalized = region ? region.toUpperCase() : null;
  // Unresolved region is not evidence of anything — never treat "unknown"
  // as "out of state."
  const inLicensedState = !normalized || LICENSED_STATES.has(normalized);
  const shouldExcludeFromLeadCapture = TARGETING_MODE === "exclude-lead-capture" && !inLicensedState;
  return { region: normalized, inLicensedState, shouldExcludeFromLeadCapture };
}
