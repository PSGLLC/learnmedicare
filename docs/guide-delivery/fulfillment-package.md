# Learn Medicare FAQ guide fulfillment — approval package

**Status (2026-11-23):** fulfillment is not enabled. The guide is live and directly accessible. The request form is intentionally unavailable until a dedicated GHL workflow, verified sender/reply-to, complete automation review, and dedicated webhook secret are confirmed. Separate preview and production D1 request ledgers are provisioned, migrated, bound, and deployed; this does not by itself deliver email. No message has been sent and no FAQ request form is active.
**Prepared:** 2026-11-22; status and infrastructure evidence updated 2026-11-23.
**Website entry point:** `https://learnmedicare.org/faq/` → `POST /api/faq-lead`.

## Guide source and current downloadable asset

- Editable prior 2026 source: Canva design **“2026 T65 Guide (short)”** (`DAG5SJOwdrc`). The currently linked production file is `public/docs/T65-Medicare-Guide-2026.pdf` (four pages, SHA-256 `e281bf8637cccbc3d390bdb579856b7f33c7b2c54c2cc034b27d61a82670a83a`). It is preserved unchanged and clearly labeled 2026.
- A separate Canva design **“2027 T65 Guide (short)”** (`DAHbOl5SZZ4`) is a prior working duplicate, not the deliverable in this PR. Earlier content review identified outdated/inaccurate guidance in that draft. This PR uses the repository PDFKit layout instead and does not edit either Canva design.
- New editable source and source-linked online guide: `src/pages/medicare-at-65-guide.md`, at the stable yearless route `/medicare-at-65-guide/`. Its official citations are clickable HTML links. The page links to the current printable PDF.
- PR #19 merged as `b0ed1e096ce8e8236197b9fadfd6cda383b6ed94`. The live yearless PDF is the branded 2027 edition produced by the shared facts/template and PDFKit renderer. Local manifest SHA-256: `8741466282606223e8dc491bee901cbab69c910a1ff98dad0656025abbe017a0`; production response SHA-256: `5b52084af9ec3f8e6fb7b23985e01af1e8dff97d4864fa3ec7ebe1771d605e7d` (Cloudflare build output). The separate 2026 PDF remains unchanged at `public/docs/T65-Medicare-Guide-2026.pdf` (SHA-256 `e281bf8637cccbc3d390bdb579856b7f33c7b2c54c2cc034b27d61a82670a83a`). This is an editable repository layout-tool version, not a Canva-editable design; the original Canva design is preserved.
- The online guide, review text, and PDF are generated from `src/data/medicare-guide-facts.json` plus `docs/guide-delivery/medicare-at-65-guide.template.md`. This is the one maintained content source for both outputs.
- **Production verification (2026-11-23):** Cloudflare Pages project `learnmedicare` reports production deployment `7887d6a6-c4a6-48c6-8540-65568c65b37c`, branch `main`, source `b0ed1e0`, alias `learnmedicare.org`. The [online guide](https://learnmedicare.org/medicare-at-65-guide/) returned 200 with descriptive metadata and self-canonical, WebPage/BreadcrumbList JSON-LD, one H1, and sitemap inclusion. The yearless [PDF](https://learnmedicare.org/docs/T65-Medicare-Guide.pdf) returned 200 `application/pdf`, with `Link: <https://learnmedicare.org/medicare-at-65-guide/>; rel="canonical"`, no production noindex header, 12 pages, selectable text, and 164 clickable annotations. The 2026 archive still returns 200 and matches its original SHA-256. No production search indexing, rankings, or AI citations are claimed.

## Production binding evidence and limitation

Read-only GHL inspection on 2026-11-23 found the existing `LearnMedicare Guide Request` workflow (`7217513e-3682-432b-808f-4326f2e455be`, inbound trigger `5a235da3-9ffe-4af3-bc5b-b6d07f4035a1`) listed as Published with 5 total and 0 active enrollees. Its builder showed an inbound webhook trigger with no filters and one Create Contact action; it has no email action and is not the proposed one-time delivery workflow. The separate `LearnMedicare Drip Campaign` (`4d0866d5-6ade-4aca-af29-0a9c69270835`) is listed as Published with 0 total/active enrollees; its inspected trigger is Contact Tag added includes `learnmedicare-lead`, not the FAQ-specific `learnmedicare-faq-lead`. That tag condition does not match FAQ requests. These observations do not establish that no other contact-created/updated/tag automation can run.

**GHL access/runtime diagnosis (2026-11-23):** In the signed-in Price Services Group location (`RMrQyYPseTazGPmAynzT`), the main app shell and location navigation render. The workflow list and the two targeted existing workflow records were readable earlier in the session, so this is not evidence of missing workflow-view permission. An earlier navigation through the app, the embedded workflow-list frame `client-app-automation-workflows.leadconnectorhq.com/v2/location/RMrQyYPseTazGPmAynzT/automation/workflows?listTab=all` returned HTTP 404 with an empty `text/html` response while the outer app remained signed in. A subsequent clean navigation through the main app sidebar loaded the list and visible rows, so the 404 did not reproduce. It was a transient embedded-app/runtime failure, not an authorization response. The Settings → Email Services deep route stayed on the outer “Loading your workspace…” shell; no sender configuration rendered and no 401/403 was observed. The page offers no evidence that the account lacks permission. Current sender and monitored reply-to remain unverified, as does the complete contact-created/updated/tag-triggered automation inventory, its notification recipients, and re-entry settings. No settings or workflows were changed.

Cloudflare Pages currently has secrets named `GHL_GUIDE_WEBHOOK_URL` (shared), `GHL_WEB_LEAD_WEBHOOK_URL`, and `COURSE_PREVIEW_SECRET`; the dedicated `GHL_FAQ_GUIDE_WEBHOOK_URL` secret is absent. Do not repurpose or alter the shared guide webhook. Preview D1 is `learnmedicare-faq-preview` (`ba6a265a-1b7a-4c83-9916-b16d5dd06cba`); production D1 is `learnmedicare-faq-production` (`3f18e192-3fd0-4bfa-bad5-1d067fdaf66f`). The additive `0001_faq_guide_requests.sql` migration is applied and migration-tracked in both; both databases had zero request rows at verification. PR #21 merged as `0d639b2d76e3dbf4206c8a4c3b1b9a6ba66948c2`, and the production Pages config confirms the `FAQ_GUIDE_REQUESTS` binding points to the production database while preview uses its separate database. Cloudflare deployment `4e6642b7-8858-4afe-b8d4-29d0a5315f56` is Active from `0d639b2`. PR #22 merged as `2a8377aa92109e5df854fbb7369c0a90ca5620c0`; deployment `8c4377f5-e458-4a6b-ac76-2e16b0c6f3f0` is Active from `2a8377a`. Its isolated suite passed 178 tests with zero failures or skips. The FAQ form remains unavailable under PR #20; its direct online-guide and PDF links remain available. No fulfillment email is enabled.

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

**Greeting:** Use `Hello {{contact.first_name}},` when a first name is present. When it is blank, use `Hello there,`. Implement this with a verified GHL conditional branch or a tested safe merge-field default; do not assume an unverified fallback syntax.

**Body (approved copy after the greeting):**

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

1. Site Function validates the FAQ request, requires the dedicated `FAQ_GUIDE_REQUESTS` D1 binding/table, inserts the opaque request ID as a unique processing claim, and only then makes one POST to `GHL_FAQ_GUIDE_WEBHOOK_URL`. The separate D1 stores the request ID/status/timestamps only; it does not hold contact or guide-request PII.
2. The new dedicated GHL inbound-webhook workflow filters `requestType`, `source`, `pagePath`, valid email, empty honeypot, and request ID. It then creates/updates only first name, email, source, and the FAQ-specific tag `learnmedicare-faq-lead`.
3. It sends one transactional fulfillment email using the copy above, then ends. No SMS/call, sales assignment, opportunity creation, `learnmedicare-lead`, or `email-drip-day1` action is proposed.
4. GHL 2xx means only that the endpoint accepted the webhook. The D1 ledger prevents the site from replaying the same request ID; it does not prove inbox delivery or provide exactly-once guarantees for internal GHL/email-provider retries.

**Infrastructure and deployment now complete:** PRs #21 and #22 are merged; both database migrations are applied and tracked; separate Preview/Production bindings are deployed. Focused unit tests cover missing binding/table fail-closed behavior, request-ID idempotency, concurrency, ambiguous provider outcomes, repeat requests with a new ID, and retention. PR #22's isolated run passed 178/178 with zero failures/skips. A supplementary local Pages+D1 runtime attempt could not complete because Wrangler Pages dev reported `EMFILE: too many open files, watch`; it was stopped and not retried. This does not invalidate the passing isolated tests or Cloudflare binding/migration evidence, but local runtime integration remains unverified.

**Remaining setup before activation:** (1) restore a readable GHL location workflow list/editor for location `RMrQyYPseTazGPmAynzT` so all enabled contact-created, contact-updated, and tag-triggered workflows can be inspected for side effects, recipients, and re-entry; (2) expose Settings → Email Services in that same location so an already verified sender and monitored reply-to can be confirmed, or have the owner configure/approve one without changing domain authentication; (3) create the dedicated webhook workflow and verify the conditional greeting, approved copy, exact filters, and absence of marketing/call/SMS/opportunity/assignment actions; (4) add the dedicated write-only Pages secret `GHL_FAQ_GUIDE_WEBHOOK_URL` mapped to that workflow's inbound webhook; (5) verify the saved/published workflow and secret/binding configuration read-only; then restore the FAQ request form and run one controlled production test after the user supplies a recipient they control. Do not change `GHL_GUIDE_WEBHOOK_URL`, shared workflows, or existing email configuration. GHL runtime is intermittent: the signed-in app rendered the workflow list and two targeted records earlier, but a later embedded list request returned an empty HTTP 404. Email Services remained on the loading shell without sender configuration. No production email action, outbound message, form submission, or new CRM record has been created.

### Manual GHL setup handoff if the editor fails again

In location **Price Services Group, L.L.C.** (`RMrQyYPseTazGPmAynzT`), first confirm an already verified sender and monitored reply-to in **Settings → Email Services**; do not change domain authentication or guess an address. Review all enabled **Contact Created**, **Contact Updated**, and **Contact Tag** workflows and document each matching workflow's trigger filters, actions, recipient(s), and re-entry behavior before enabling a new one. Do not edit the existing `LearnMedicare Drip Campaign` or Ruby/resend workflows.

Then create a dedicated workflow named **Learn Medicare FAQ — One-Time Guide Fulfillment**, triggered only by the new site's inbound webhook. Require all of: `requestType` exactly `one-time-educational-guide`; `source` exactly `learnmedicare-faq-page`; `pagePath` exactly `/faq/`; nonempty valid `email`; empty honeypot; and a nonempty opaque `requestId`. Map only `firstName`, `email`, and `source` to their intended contact fields; use the FAQ-specific tag `learnmedicare-faq-lead`, never `learnmedicare-lead` or `email-drip-day1`. Send one email with the already approved subject **Your requested 2027 Medicare at 65 guide**, greeting, and body above; don't introduce alternate copy.

> Here is the 2027 Medicare at 65 guide you requested. [Read the source-linked guide online](https://learnmedicare.org/medicare-at-65-guide/) or [download the printable PDF](https://learnmedicare.org/docs/T65-Medicare-Guide.pdf).
>
> The guide separates 2027 amounts from enrollment dates and explains where to confirm plan-specific details with Medicare, CMS, Social Security, VA, or TRICARE. The 2027 federal amounts take effect January 1, 2027; CMS announced them November 17, 2026.
>
> This is a one-time response to your guide request. It does not sign you up for ongoing marketing, calls, or text messages. If this request was not yours, you can ignore this email.
>
> Learn Medicare / Price Services Group

Do not add SMS, calls, sales assignments, opportunities, or marketing enrollment. The site's dedicated D1 ledger is the idempotency boundary: it records opaque request ID/status/timestamps, treats same-ID repeats as duplicates, and permits a later deliberate request with a new ID. Do not configure GHL/provider retry behavior to blindly replay an ambiguous send. Add the dedicated Cloudflare Pages secret `GHL_FAQ_GUIDE_WEBHOOK_URL` only after saving the workflow and obtaining its exact inbound URL; never replace the shared `GHL_GUIDE_WEBHOOK_URL`. Keep the FAQ email-request form unavailable until the sender, workflow, dedicated secret, and production binding are verified. A 2xx response means the webhook accepted a request, not that the email was delivered. This handoff has not been applied in GHL and no message has been sent.

## Rollback

Do not repoint the shared `GHL_GUIDE_WEBHOOK_URL`. To roll back after approval, disable the new GHL email action/workflow first, then remove the dedicated FAQ secret and D1 binding only after pending submissions are reconciled. Keep the FAQ endpoint failing closed and retain the tracking table until its retention period expires. Restore prior page copy only if a replacement fulfillment route is operating; do not restore the false “guide is on its way” message.

## Approval needed before activation

The user approved implementation and activation of this one-time fulfillment package. The guide and copy have already been reviewed. The separate preview/production D1 provisioning, additive migration, and bindings are complete. The remaining blockers are verified sender/reply-to, readable GHL automation inventory and workflow editor, creation/publication of the dedicated workflow, the dedicated secret mapping, and post-deploy verification. That approval does not permit ongoing marketing, SMS, calls, opportunities, sales assignment, enrolling historical requests, or sending a test to an existing contact.
