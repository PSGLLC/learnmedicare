# Learn Medicare FAQ guide fulfillment — approval package

**Status:** prepared for review; not enabled in GHL and not production-tested.
**Prepared:** 2026-11-22.
**Website entry point:** `https://learnmedicare.org/faq/` → `POST /api/faq-lead`.

## Guide source and current downloadable asset

- Editable prior 2026 source: Canva design **“2026 T65 Guide (short)”** (`DAG5SJOwdrc`). The currently linked production file is `public/docs/T65-Medicare-Guide-2026.pdf` (four pages, SHA-256 `e281bf8637cccbc3d390bdb579856b7f33c7b2c54c2cc034b27d61a82670a83a`). It is preserved unchanged and clearly labeled 2026.
- A separate Canva design **“2027 T65 Guide (short)”** (`DAHbOl5SZZ4`) is a prior working duplicate, not the deliverable in this PR. Earlier content review identified outdated/inaccurate guidance in that draft. This PR uses the repository PDFKit layout instead and does not edit either Canva design.
- New editable source and source-linked online guide: `src/pages/medicare-at-65-guide.md`, at the stable yearless route `/medicare-at-65-guide/`. Its official citations are clickable HTML links. The page links to the current printable PDF.
- In PR #19, the yearless PDF review asset and dated 2027 edition are byte-identical outputs from the shared facts/template and PDFKit renderer. See `pdf-manifest.json` for page count, embedded-font, link, and SHA evidence. The separate 2026 PDF remains unchanged at `public/docs/T65-Medicare-Guide-2026.pdf` (SHA-256 `e281bf8637cccbc3d390bdb579856b7f33c7b2c54c2cc034b27d61a82670a83a`). This is an editable repository layout-tool version, not a Canva-editable design. PR #19 is unmerged, so production remains unchanged.
- The online guide, review text, and PDF are generated from `src/data/medicare-guide-facts.json` plus `docs/guide-delivery/medicare-at-65-guide.template.md`. This is the one maintained content source for both outputs.
- **Historical production evidence:** PR #18 merged at `2026-11-22T23:07:48Z` as `9a6785a27d67725ea92afb59843179cfe198f0f7`. A normal HTTP check at `2026-11-22T23:31:53Z` returned 200 for the then-current online page/PDF; that PDF hash was `cb4133b45c4f6aa3ff25a4d53da366c0bc8f487e307be29d8dfcba0aeffdbc2b`. PR #19 remains unmerged, so the PDFKit review asset in this PR has not replaced that live asset. The owner selected the prior Canva guide as a visual reference; this PR does not change Canva. These checks are historical response evidence, not a current provider deployment-record mapping. Email fulfillment remains inactive. See `docs/guide-delivery/ANNUAL-GUIDE-MAINTENANCE.md` for current annual review, generation, approval, and rollback steps.

## Production binding evidence and limitation

Read-only inspection of the published GHL workflow shows workflow ID `7217513e-3682-432b-808f-4326f2e455be` and inbound trigger ID `5a235da3-9ffe-4af3-bc5b-b6d07f4035a1`. Its only action is Create/Update Contact; it has no send-email action. The separate published drip workflow ID `4d0866d5-6ade-4aca-af29-0a9c69270835` listens for `learnmedicare-lead`, while this FAQ endpoint sends the distinct source tag `learnmedicare-faq-lead`; the FAQ request is not enrolled through that observed tag condition. The workflow-list view returned the app shell but no list rows, so this review cannot establish that no other location-wide contact-created/updated automations exist. Before activation, enumerate all enabled location workflows that can match contact creation/update or the FAQ source tag and record their actions, recipients, and re-entry settings. These facts also do not establish the production endpoint secret's binding.

Cloudflare Pages exposes a write-only encrypted `GHL_GUIDE_WEBHOOK_URL` secret shared by the FAQ, guide, course, and agent endpoints. Its value cannot be read for comparison. Therefore the secret-to-trigger binding for the live FAQ form is **unverified**. Do not change or reuse that shared secret. The implementation in this review package uses a new dedicated `GHL_FAQ_GUIDE_WEBHOOK_URL` binding and requires a new, separate GHL workflow after approval.

## Proposed dedicated GHL workflow

Create **LearnMedicare FAQ One-Time Guide Fulfillment** in the Learn Medicare/Price Services Group location. Its dedicated inbound webhook receives only FAQ submissions. The website's D1 ledger claims the request ID before it sends one webhook call; GHL does not need direct D1 access. Conditions before any email action:

- `requestType` exactly `one-time-educational-guide`;
- `source` exactly `learnmedicare-faq-page`;
- `pagePath` exactly `/faq/`;
- valid email present; honeypot empty;
- a request ID is present (site-side D1 is the authoritative duplicate guard; do not create a GHL action that tries to query D1).

Actions: create/update the contact with first name and email; send one fulfillment email below. Do not add `learnmedicare-lead` or `email-drip-day1`; do not add SMS, calls, opportunity creation, or unrelated assignment actions. Do not infer marketing consent from the guide request. Review any location-wide workflows triggered by contact creation before activation; their exact behavior and recipients must be inspected in GHL first.

## One-time email copy

**Subject:** Your requested 2027 Medicare at 65 guide

**Body:**

> Hello {{contact.first_name}},
>
> Here is the 2027 Medicare at 65 guide you requested. [Read the source-linked guide online](https://learnmedicare.org/medicare-at-65-guide/) or [download the printable PDF](https://learnmedicare.org/docs/T65-Medicare-Guide.pdf).
>
> The guide separates 2027 amounts from enrollment dates and explains where to confirm plan-specific details with Medicare, CMS, Social Security, VA, or TRICARE. The 2027 federal amounts take effect January 1, 2027; CMS announced them November 17, 2026.
>
> This is a one-time response to your guide request. It does not sign you up for ongoing marketing, calls, or text messages. If this request was not yours, you can ignore this email.
>
> Learn Medicare / Price Services Group

The public guide and current PDF URLs are yearless; dated 2026 and 2027 PDF editions remain separate. Do not enable the workflow until the page and both current-guide links have been reviewed. Email delivery must be confirmed from GHL execution/delivery records; an endpoint 2xx is not delivery evidence.

## Request and failure behavior

- Each page load creates one random request ID. A deliberate later request requires the user to choose **Request another copy**, which creates a fresh ID.
- D1 stores only the opaque request ID, status, and timestamps, with a 90-day retention. It stores no name, email, message, IP address, consent, or webhook body.
- A unique key prevents duplicate and concurrent sends for the same request ID. The same ID is never replayed after a provider timeout or ambiguous response.
- Missing D1 binding/table or missing dedicated webhook fails closed before any GHL write.
- A webhook 2xx is reported only as workflow acceptance; the website expressly says it cannot confirm email delivery. A timeout/negative response is shown as unconfirmed and the visitor is told not to immediately repeat the same request.
- An intentionally later request is allowed via the explicit new-request control. No marketing opt-in is collected or inferred.
- A second request after that explicit action gets a new request ID and can be processed as a distinct fulfillment. Reopening/replaying the same request ID returns its stored state and does not trigger a second webhook.

## FAQ visitor-facing copy

- **Disclosure:** “We’ll use your name and email to process this one-time guide request. It does not sign you up for ongoing marketing, calls, or text messages. See our Privacy Policy.”
- **Button:** “Request the Free Guide.” After a successful request, a separate button says “Request another copy” and creates a new request ID.
- **Success:** “Your request was accepted for processing. This page cannot confirm email delivery. Check your inbox and spam folder; if the guide does not arrive, contact us rather than immediately submitting the same request again.”
- **Confirmed/ambiguous provider failure:** “We could not confirm what happened to this request. Please do not submit it again yet; contact us if you still need the guide.”
- **Already processing:** “This request is already being processed. Please wait before trying again.”
- **Missing tracking binding/table or fulfillment endpoint:** “Guide requests are temporarily unavailable. Please contact us for the guide.”
- **Invalid input:** required first name/email: “First name and email are required.” Invalid email: “Enter a valid email address.” Invalid request ID: “Refresh the page and try again.” An unexpected response falls back to “Something went wrong. Please try again.”

## Exact proposed GHL actions and dependencies

1. Site Function validates the FAQ request, requires the dedicated `FAQ_GUIDE_REQUESTS` D1 binding/table, inserts the opaque request ID as a unique processing claim, and only then makes one POST to `GHL_FAQ_GUIDE_WEBHOOK_URL`.
2. The new dedicated GHL inbound-webhook workflow filters `requestType`, `source`, `pagePath`, valid email, empty honeypot, and request ID. It then creates/updates only first name, email, source, and the FAQ-specific tag `learnmedicare-faq-lead`.
3. It sends one transactional fulfillment email using the copy above, then ends. No SMS/call, sales assignment, opportunity creation, `learnmedicare-lead`, or `email-drip-day1` action is proposed.
4. GHL 2xx means only that the endpoint accepted the webhook. The D1 ledger prevents the site from replaying the same request ID; it does not prove inbox delivery or provide exactly-once guarantees for internal GHL/email-provider retries.

Required setup before activation: provision one dedicated Learn Medicare production D1 database; bind it as `FAQ_GUIDE_REQUESTS`; apply `migrations/0001_faq_guide_requests.sql`; add the dedicated write-only Pages secret `GHL_FAQ_GUIDE_WEBHOOK_URL` mapped to the new workflow's inbound webhook; and create, test, and inspect that workflow in the Learn Medicare GHL location. Do not change the shared `GHL_GUIDE_WEBHOOK_URL` or production email configuration until the package is approved.

## Rollback

Do not repoint the shared `GHL_GUIDE_WEBHOOK_URL`. To roll back after approval, disable the new GHL email action/workflow first, then remove the dedicated FAQ secret and D1 binding only after pending submissions are reconciled. Keep the FAQ endpoint failing closed and retain the tracking table until its retention period expires. Restore prior page copy only if a replacement fulfillment route is operating; do not restore the false “guide is on its way” message.

## Approval needed before activation

Review and approve (a) the 2027 online guide and printable asset, (b) the exact one-time email above, (c) the dedicated workflow and any global contact-create side effects/recipients, (d) the dedicated secret-to-trigger mapping, and (e) provisioning/binding a dedicated D1 database with the included migration. No production GHL email action or message is enabled by this PR.
