# Learn Medicare FAQ guide fulfillment — approval package

**Status:** fulfillment is not enabled. The dedicated production webhook and D1 request ledger are unconfigured. The guide is live and directly accessible; a follow-up page change will state that one-time email requests are unavailable until an owner approves and configures delivery.
**Prepared:** 2026-11-22.
**Website entry point:** `https://learnmedicare.org/faq/` → `POST /api/faq-lead`.

## Guide source and current downloadable asset

- Editable prior 2026 source: Canva design **“2026 T65 Guide (short)”** (`DAG5SJOwdrc`). The currently linked production file is `public/docs/T65-Medicare-Guide-2026.pdf` (four pages, SHA-256 `e281bf8637cccbc3d390bdb579856b7f33c7b2c54c2cc034b27d61a82670a83a`). It is preserved unchanged and clearly labeled 2026.
- A separate Canva design **“2027 T65 Guide (short)”** (`DAHbOl5SZZ4`) is a prior working duplicate, not the deliverable in this PR. Earlier content review identified outdated/inaccurate guidance in that draft. This PR uses the repository PDFKit layout instead and does not edit either Canva design.
- New editable source and source-linked online guide: `src/pages/medicare-at-65-guide.md`, at the stable yearless route `/medicare-at-65-guide/`. Its official citations are clickable HTML links. The page links to the current printable PDF.
- PR #19 merged as `b0ed1e096ce8e8236197b9fadfd6cda383b6ed94`. The live yearless PDF is the branded 2027 edition produced by the shared facts/template and PDFKit renderer. Local manifest SHA-256: `8741466282606223e8dc491bee901cbab69c910a1ff98dad0656025abbe017a0`; production response SHA-256: `5b52084af9ec3f8e6fb7b23985e01af1e8dff97d4864fa3ec7ebe1771d605e7d` (Cloudflare build output). The separate 2026 PDF remains unchanged at `public/docs/T65-Medicare-Guide-2026.pdf` (SHA-256 `e281bf8637cccbc3d390bdb579856b7f33c7b2c54c2cc034b27d61a82670a83a`). This is an editable repository layout-tool version, not a Canva-editable design; the original Canva design is preserved.
- The online guide, review text, and PDF are generated from `src/data/medicare-guide-facts.json` plus `docs/guide-delivery/medicare-at-65-guide.template.md`. This is the one maintained content source for both outputs.
- **Production verification (2026-11-23):** Cloudflare Pages project `learnmedicare` reports production deployment `7887d6a6-c4a6-48c6-8540-65568c65b37c`, branch `main`, source `b0ed1e0`, alias `learnmedicare.org`. The [online guide](https://learnmedicare.org/medicare-at-65-guide/) returned 200 with descriptive metadata and self-canonical, WebPage/BreadcrumbList JSON-LD, one H1, and sitemap inclusion. The yearless [PDF](https://learnmedicare.org/docs/T65-Medicare-Guide.pdf) returned 200 `application/pdf`, with `Link: <https://learnmedicare.org/medicare-at-65-guide/>; rel="canonical"`, no production noindex header, 12 pages, selectable text, and 164 clickable annotations. The 2026 archive still returns 200 and matches its original SHA-256. No production search indexing, rankings, or AI citations are claimed.

## Production binding evidence and limitation

Read-only GHL inspection on 2026-11-23 found the existing `LearnMedicare Guide Request` workflow (`7217513e-3682-432b-808f-4326f2e455be`, inbound trigger `5a235da3-9ffe-4af3-bc5b-b6d07f4035a1`) listed as Published with 5 total and 0 active enrollees. Its builder shows an inbound webhook trigger with no filters and one Create Contact action; it has no email action and is not the proposed one-time delivery workflow. The separate `LearnMedicare Drip Campaign` (`4d0866d5-6ade-4aca-af29-0a9c69270835`) is listed as Published with 0 total/active enrollees; its inspected trigger is Contact Tag added includes `learnmedicare-lead`, not the FAQ-specific `learnmedicare-faq-lead`. That tag condition does not match FAQ requests. The location has many additional workflows, so this inspection does not establish that no other contact-created/updated automation can run. Before activation, inspect all enabled workflows matching those triggers and record their actions, recipients, and re-entry settings. The GHL email-services settings page did not render configuration in the existing session; a verified sender address/reply-to could not be confirmed.

The current production Pages project has secrets named `GHL_GUIDE_WEBHOOK_URL` (shared), `GHL_WEB_LEAD_WEBHOOK_URL`, and `COURSE_PREVIEW_SECRET`; no `GHL_FAQ_GUIDE_WEBHOOK_URL` secret is present. The account's D1 database list contains no Learn Medicare FAQ request ledger. The deployed function therefore fails closed for valid requests rather than forwarding a CRM write. Do not change or reuse the shared secret. The reviewed guide remains directly accessible. A follow-up website change replaces the request form with an explicit unavailable notice and direct online/PDF links until a dedicated endpoint is configured and approved.

## Proposed dedicated GHL workflow

Create **LearnMedicare FAQ One-Time Guide Fulfillment** in the Learn Medicare/Price Services Group location. Its dedicated inbound webhook receives only FAQ submissions. The website's D1 ledger claims the request ID before it sends one webhook call; GHL does not need direct D1 access. Conditions before any email action:

- `requestType` exactly `one-time-educational-guide`;
- `source` exactly `learnmedicare-faq-page`;
- `pagePath` exactly `/faq/`;
- valid email present; honeypot empty;
- a request ID is present (site-side D1 is the authoritative duplicate guard; do not create a GHL action that tries to query D1).

Actions: create/update the contact with first name and email; send one fulfillment email below. Do not add `learnmedicare-lead` or `email-drip-day1`; do not add SMS, calls, opportunity creation, or unrelated assignment actions. Do not infer marketing consent from the guide request. Review any location-wide workflows triggered by contact creation before activation; their exact behavior and recipients must be inspected in GHL first.

## One-time email copy

**Sender identity:** No production sender or reply-to is approved or verified yet. The authenticated GHL email-services settings page rendered no configuration in the connected session. Before activation, an account owner must choose a verified sending address and reply-to in the Learn Medicare location; use display name `Learn Medicare` only if that sender identity is approved. Do not send until the verified address, reply-to, and sending domain are recorded.

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
