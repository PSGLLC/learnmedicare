# Direct GHL guide fulfillment implementation

**Branch:** `codex/faq-ghl-direct-api-fulfillment-2026-11-24`

**Status:** Reviewable implementation; not deployed to Production. GitHub's Cloudflare Pages check generated a PR preview. Preview has no GHL token; its separate hash key and explicit `off` mode are configured. The FAQ request form remains inactive. No contact was created and no email was sent.

## What changed

- Replaced the dedicated FAQ webhook call with a direct, location-scoped GHL API path in `functions/api/faq-lead.ts`.
- Added additive migration `0002_faq_guide_direct_api.sql` to the already provisioned FAQ D1 databases. It adds recipient/client HMAC hashes, a one-active-request-per-recipient index, and atomic fixed-window rate-limit storage. It stores no raw email address or IP address.
- Kept the existing request UUID as the idempotency key. A new request UUID represents a deliberate later request; same-ID repeats do not resend. A currently processing or ambiguous request locks that recipient. Ambiguous writes are never replayed automatically.
- Added mock coverage for exact match, duplicate contacts across pages, pagination, no-match behavior, disabled contact creation, failed/ambiguous creation, send timeout, queued responses, concurrency, deliberate repeats, DND, rate limits, and retention.
- Left the public form disabled and direct online/PDF guide links in place.

## Recipient and send sequence

1. The endpoint is off unless `FAQ_GUIDE_DELIVERY_MODE` is explicitly `test` or `live`. Test mode requires one exact `FAQ_GUIDE_TEST_RECIPIENT`, disallows contact creation, and limits that recipient to one request per day. Live mode also requires `FAQ_GHL_SENDER_BEHAVIOR_CONFIRMED=true`.
2. It requires the existing D1 binding, the existing Production `GHL_API_TOKEN`, and a separate `FAQ_REQUEST_HASH_KEY` of at least 32 characters. The hash key is distinct in Preview and Production. No production secret is copied into Preview.
3. It requires the Learn Medicare origin, JSON input, request UUID, valid email, empty honeypot, and Cloudflare client IP. The D1 ledger claims both request ID and recipient before any GHL call. Atomic live limits are 3 requests per recipient/day, 10 per IP/hour, and 50 total requests/day; test mode is limited to 1 per test recipient/day. HMAC-derived keys and rate counters are deleted after 90 days and 2 days respectively. Keep the HMAC key stable while any processing/ambiguous records exist; changing it would make older recipient locks unmatchable.
4. It uses `GET /contacts/lookup` with the fixed PSG location ID, exact email, Version `v3`, and cursor pagination. Results are additionally checked for location and exact primary/additional email. One match uses that contact ID and sends to the submitted address without changing contact fields, name, ownership, consent, tags, or other CRM data. More than one match returns help guidance without choosing or sending. Lookup errors or incomplete pagination fail closed.
5. On no match, the endpoint returns assistance guidance by default. Contact creation is possible only in live mode when both `FAQ_GHL_CONTACT_CREATION_ENABLED=true` and `FAQ_GHL_CONTACT_CREATED_EFFECTS_APPROVED=true`. Both are explicitly `false` in Preview and Production; that branch remains off until Contact Created automations are inspected and approved. Contact creation sends only location ID, email, first name, and source; it uses no upsert and no automatic retry. A timeout or unclear successful response is marked ambiguous and holds the recipient lock.
6. A matched/created contact is sent one approved message through `POST /conversations/messages`, with its contact ID, exact destination email, `emailFrom: info@priceservicesgroup.com`, `status: pending`, approved subject and body, and the yearless guide links. A successful response with a GHL message ID is recorded in the request ledger as **queued**, with that provider message ID for later manual reconciliation—not as sent or delivered. The endpoint returns `emailDelivered: false`. A timeout, 5xx, 429, or malformed 2xx response is ambiguous and is not retried; its recipient lock remains until manually reconciled or the 90-day ledger retention expires. A later deliberate request can proceed after a queued or known non-send result, subject to rate limits. A `sent` status read later from GHL and owner-confirmed inbox receipt remain separate evidence; no automatic status polling or resend is implemented.

## HighLevel support and remaining sender proof

Current official API documentation supports:

- Exact, location-scoped email lookup, up to 20 contacts per page, with `nextCursor`; scope `contacts.readonly`.
- Contact creation at `POST /contacts`, scope `contacts.write`. HighLevel warns that retrying a timed-out create can produce a duplicate, so this implementation does not retry it.
- Email messages at `POST /conversations/messages`, scope `conversations/message.write`, with `contactId`, `emailTo`, `emailFrom`, `subject`, `html`/`message`. The API response can mean “queued”; it is not delivery evidence.

Official references: [Lookup Contact](https://marketplace.gohighlevel.com/docs/ghl/contacts/lookup-contact/index.html), [Create Contact](https://marketplace.gohighlevel.com/docs/ghl/contacts/create-contact/), [Send a new message](https://marketplace.gohighlevel.com/docs/ghl/conversations/send-a-new-message/).

The sender owner-provided values are From name `Kayla Price`, From address `info@priceservicesgroup.com`, and Reply-To `info@priceservicesgroup.com`. The current message API schema documents `emailFrom` as an email address but has no documented From-name or Reply-To request field. The location’s Private Email provider and saved Reply-To settings were previously observed, but that does not prove the direct API uses them. Accordingly:

- This code explicitly sets only the approved From address. It does not invent unsupported `fromName` or `replyTo` fields.
- `FAQ_GHL_SENDER_BEHAVIOR_CONFIRMED` is explicitly `false` in Preview and Production. It may be changed only after a controlled send confirms the actual From name, From address, Reply-To behavior, and provider delivery records. The known GHL warning that Reply-To messages do not enter the CRM conversation thread remains relevant.
- `GHL_API_TOKEN` exists as an encrypted Learn Medicare Production secret and is absent from Preview. In the authenticated GHL account, the configured source location ID `RMrQyYPseTazGPmAynzT` resolved to **Price Services Group, L.L.C.** The Private Integrations list did not identify which integration backs Learn’s Cloudflare secret, and its detail view did not display a scope list; therefore the Learn token's `contacts.readonly`, `conversations/message.write`, and (only if contact creation is later approved) `contacts.write` permissions remain **unverified**. No token value was revealed or used for an API call.

## Deployment and rollback

**Non-sending preparation completed 2026-11-25:** after checking each existing database’s schema and migration history, additive migration `0002_faq_guide_direct_api.sql` was applied to the existing Preview database `learnmedicare-faq-preview` (`ba6a265a-1b7a-4c83-9916-b16d5dd06cba`) and Production database `learnmedicare-faq-production` (`3f18e192-3fd0-4bfa-bad5-1d067fdaf66f`). Both now report no pending migrations; the new hash columns, active-recipient index, and rate-limit table were verified read-only. No database was created or deleted. A separate random `FAQ_REQUEST_HASH_KEY` was added as an encrypted secret in each environment; values were not printed or copied between environments. `FAQ_GUIDE_DELIVERY_MODE` was explicitly set to `off`, the sender-confirmation gate was set to `false`, and both contact-creation approval gates were set to `false` in Preview and Production. Secret listings confirm the expected bindings by name and leave their values encrypted. The public request form remains inactive, no contact or email was created/sent, and the unused GHL fulfillment workflow remains Draft.

Before any controlled send:

1. Read the Learn Production Private Integration's granted scopes through the authorized configuration view, and establish which integration backs the Learn `GHL_API_TOKEN`; required send-test scopes are `contacts.readonly` and `conversations/message.write`. No email is needed to confirm scopes. Keep Preview’s token absent.
2. Have the owner provide the exact recipient email for this Learn test (do not reuse a Ruby/resend test contact). Use read-only lookup in location `RMrQyYPseTazGPmAynzT`, follow every `nextCursor`, and proceed only if exactly one existing contact has the submitted email. Stop on zero, duplicate, or conflicting matches; do not create/update a contact.
3. Keep the request form inactive. For one approved controlled Production test only, use test mode and allowlist that exact owner-controlled email; test mode cannot create a contact and is capped at one request per recipient/day. The API sender must be verified by that test; do not set the sender-confirmation gate before observing the actual From name/address, Reply-To, provider route, and message/provider record.
4. Inspect the D1 request outcome and GHL message/provider status separately; the API response may only confirm queuing. The owner confirms inbox receipt. Never retry an ambiguous send.
5. After verification, return the mode to `off` unless the owner separately approves broader operation. Do not enable the saved GHL workflow; it remains Draft and unused.

Rollback: set `FAQ_GUIDE_DELIVERY_MODE=off` (already configured) or remove the endpoint’s access to GHL first. This closes API calls while preserving direct guide access. Leave the D1 ledger, additive migration, and hash keys in place; do not delete rows or databases. Revert code only after there are no processing/ambiguous requests to reconcile.

## Controlled test requirements

After PR review and deployment, the owner must provide a recipient email they control and approve one request. Before that single test, verify the token scopes, exact contact resolution (one existing record), contact email DND state, and intended sender behavior. Use test mode with that exact recipient, no contact creation, and the public request form still unavailable unless separately restored for the test. Inspect GHL execution/message status and actual From/Reply-To; the owner confirms inbox receipt. Do not retry an ambiguous result; inspect the request ledger and GHL message record first.
