# Learn Medicare FAQ guide fulfillment — approval package

**Status:** prepared for review; not enabled in GHL and not production-tested.
**Prepared:** 2026-11-22.
**Website entry point:** `https://learnmedicare.org/faq/` → `POST /api/faq-lead`.

## Guide source and current downloadable asset

- Editable prior 2026 source: Canva design **“2026 T65 Guide (short)”** (`DAG5SJOwdrc`). The currently linked production file is `public/docs/T65-Medicare-Guide-2026.pdf` (four pages, SHA-256 `e281bf8637cccbc3d390bdb579856b7f33c7b2c54c2cc034b27d61a82670a83a`). It is preserved unchanged and clearly labeled 2026.
- A separate Canva design **“2027 T65 Guide (short)”** (`DAHbOl5SZZ4`) is a working duplicate, not proof of a reviewed final. Its six-page text was reviewed in full. It contained 2027 values, but incorrectly extended the Part B eight-month SEP to Part D, overgeneralized employer-size/current-work rules, recommended Part A-only enrollment without an HSA caveat, omitted the Part D penalty's base amount and rounding, and used unsupported “ensures”/“most affordable” claims. No Canva design was edited or saved in this work.
- New editable review source: `docs/guide-delivery/2027-turning-65-guide.md`. Review PDF: `public/docs/T65-Medicare-Guide-2027.pdf` (six pages; SHA-256 recorded in the PR description). It preserves the original 2026 asset and adds official citations. The new file is in the draft PR only; it is not yet live.
- PDF layout is a clean printable text export to avoid changing the existing Canva asset. The official-source URLs are printed for reference; approve the copy and layout before sending it as a consumer resource.

## Production binding evidence and limitation

Read-only inspection of the published GHL workflow shows workflow ID `7217513e-3682-432b-808f-4326f2e455be` and inbound trigger ID `5a235da3-9ffe-4af3-bc5b-b6d07f4035a1`. Its only action is Create/Update Contact; it has no send-email action. The separate drip workflow listens for `learnmedicare-lead`, while the FAQ endpoint currently uses `learnmedicare-faq-lead`, so the FAQ request is not enrolled through that tag. These facts do not establish the production endpoint secret's binding.

Cloudflare Pages exposes a write-only encrypted `GHL_GUIDE_WEBHOOK_URL` secret shared by the FAQ, guide, course, and agent endpoints. Its value cannot be read for comparison. Therefore the secret-to-trigger binding for the live FAQ form is **unverified**. Do not change or reuse that shared secret. The implementation in this review package uses a new dedicated `GHL_FAQ_GUIDE_WEBHOOK_URL` binding and requires a new, separate GHL workflow after approval.

## Proposed dedicated GHL workflow

Create **LearnMedicare FAQ One-Time Guide Fulfillment** in the Learn Medicare/Price Services Group location. Its dedicated inbound webhook receives only FAQ submissions. Conditions before any email action:

- `requestType` exactly `one-time-educational-guide`;
- `source` exactly `learnmedicare-faq-page`;
- `pagePath` exactly `/faq/`;
- valid email present; honeypot empty;
- request ID has not already completed in the site-side ledger.

Actions: create/update the contact with first name and email; send one fulfillment email below. Do not add `learnmedicare-lead` or `email-drip-day1`; do not add SMS, calls, opportunity creation, or unrelated assignment actions. Do not infer marketing consent from the guide request. Review any location-wide workflows triggered by contact creation before activation; their exact behavior and recipients must be inspected in GHL first.

## One-time email copy

**Subject:** Your requested 2027 Medicare at 65 guide

**Body:**

> Hello {{contact.first_name}},
>
> Here is the 2027 Medicare at 65 guide you requested: [Open the guide](https://learnmedicare.org/docs/T65-Medicare-Guide-2027.pdf).
>
> The guide separates 2027 amounts from enrollment dates and explains where to confirm plan-specific details with Medicare, CMS, Social Security, VA, or TRICARE. The 2027 federal amounts take effect January 1, 2027; CMS announced them November 17, 2026.
>
> This is a one-time response to your guide request. It does not sign you up for ongoing marketing, calls, or text messages. If this request was not yours, you can ignore this email.
>
> Learn Medicare / Price Services Group

The URL is the proposed year-specific asset path and must not be enabled in the workflow until the final PDF is reviewed and deployed. Email delivery must be confirmed from GHL execution/delivery records; an endpoint 2xx is not delivery evidence.

## Request and failure behavior

- Each page load creates one random request ID. A deliberate later request requires the user to choose **Request another copy**, which creates a fresh ID.
- D1 stores only the opaque request ID, status, and timestamps, with a 90-day retention. It stores no name, email, message, IP address, consent, or webhook body.
- A unique key prevents duplicate and concurrent sends for the same request ID. The same ID is never replayed after a provider timeout or ambiguous response.
- Missing D1 binding/table or missing dedicated webhook fails closed before any GHL write.
- A webhook 2xx is reported only as workflow acceptance; the website expressly says it cannot confirm email delivery. A timeout/negative response is shown as unconfirmed and the visitor is told not to immediately repeat the same request.
- An intentionally later request is allowed via the explicit new-request control. No marketing opt-in is collected or inferred.

## Rollback

Do not repoint the shared `GHL_GUIDE_WEBHOOK_URL`. To roll back after approval, disable the new GHL email action/workflow first, then remove the dedicated FAQ secret and D1 binding only after pending submissions are reconciled. Keep the FAQ endpoint failing closed and retain the tracking table until its retention period expires. Restore prior page copy only if a replacement fulfillment route is operating; do not restore the false “guide is on its way” message.

## Approval needed before activation

Review and approve (a) the 2027 guide asset, (b) the exact one-time email above, (c) the dedicated workflow and any global contact-create side effects/recipients, (d) the dedicated secret-to-trigger mapping, and (e) provisioning/binding a dedicated D1 database with the included migration. No production GHL email action or message is enabled by this PR.
