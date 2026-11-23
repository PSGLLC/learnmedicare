import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const REQUEST_A = 'e1c8f6b5-6827-4b32-9c51-621d6a011d7f';
const REQUEST_B = 'a48f43c4-ef0c-4fb7-b95f-193e2e56d288';

function fakeD1({ missingTable = false } = {}) {
  const rows = new Map();
  const statements = [];
  return {
    rows, statements,
    prepare(sql) {
      statements.push(sql);
      return { bind(...values) {
        return {
          async run() {
            if (missingTable) throw new Error('no such table');
            if (sql.startsWith('INSERT INTO faq_guide_requests')) {
              if (rows.has(values[0])) return { meta: { changes: 0 } };
              rows.set(values[0], { status: values[1] ?? 'processing' });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('UPDATE faq_guide_requests')) {
              const [status, id] = values;
              if (rows.get(id)?.status === 'processing') rows.set(id, { status });
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          },
          async first() {
            if (missingTable) throw new Error('no such table');
            return rows.get(values[0]) ?? null;
          },
        };
      } };
    },
  };
}

function loadEndpoint({ status = 200, fetchImpl, db = fakeD1() } = {}) {
  const entry = new URL('../functions/api/faq-lead.ts', import.meta.url).pathname;
  const code = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
  const requests = [];
  const context = {
    module: { exports: {} }, Request, Response, URL, AbortSignal,
    fetch: async (url, init = {}) => {
      requests.push({ url: String(url), payload: JSON.parse(init.body) });
      return fetchImpl ? fetchImpl(url, init) : Response.json({ accepted: true }, { status });
    },
  };
  vm.runInNewContext(code, context);
  return { handler: context.module.exports.onRequestPost, requests, db };
}

function request(requestId = REQUEST_A) {
  return new Request('https://learnmedicare.org/api/faq-lead', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName: 'Synthetic', email: 'reader@example.invalid', pagePath: '/faq/', requestId }),
  });
}

const env = db => ({
  GHL_FAQ_GUIDE_WEBHOOK_URL: 'https://ghl.invalid/dedicated-faq-trigger',
  FAQ_GUIDE_REQUESTS: db,
});

test('FAQ guide delivery requires tracking storage before any CRM write', async () => {
  for (const database of [undefined, fakeD1({ missingTable: true })]) {
    const mock = loadEndpoint({ db: database });
    const response = await mock.handler({ request: request(), env: env(database) });
    assert.equal(response.status, 503);
    assert.equal(mock.requests.length, 0);
  }
  const noWebhook = loadEndpoint();
  const response = await noWebhook.handler({ request: request(), env: { FAQ_GUIDE_REQUESTS: noWebhook.db } });
  assert.equal(response.status, 503);
  assert.equal(noWebhook.requests.length, 0);
});

test('accepted webhook is not represented as confirmed email delivery and carries no marketing opt-in', async () => {
  const mock = loadEndpoint();
  const response = await mock.handler({ request: request(), env: env(mock.db) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.deliveryStatus, 'accepted');
  assert.equal(body.emailDelivered, false);
  assert.equal(mock.requests.length, 1);
  assert.equal(mock.requests[0].payload.requestId, REQUEST_A);
  assert.equal(mock.requests[0].payload.requestType, 'one-time-educational-guide');
  assert.deepEqual(mock.requests[0].payload.tags, ['learnmedicare-faq-lead']);
  assert.equal('tcpaConsent' in mock.requests[0].payload, false);
  assert.equal('smsOptIn' in mock.requests[0].payload, false);
  assert.equal('lastName' in mock.requests[0].payload, false);
});

test('the same request ID is not delivered again, while a new explicit request can be accepted later', async () => {
  const mock = loadEndpoint();
  await mock.handler({ request: request(), env: env(mock.db) });
  const repeat = await mock.handler({ request: request(), env: env(mock.db) });
  assert.equal((await repeat.json()).duplicate, true);
  assert.equal(mock.requests.length, 1);
  const later = await mock.handler({ request: request(REQUEST_B), env: env(mock.db) });
  assert.equal(later.status, 200);
  assert.equal(mock.requests.length, 2);
});

test('ambiguous provider response is recorded and never blindly replayed', async () => {
  const mock = loadEndpoint({ fetchImpl: async () => { throw new Error('timeout after possible write'); } });
  const first = await mock.handler({ request: request(), env: env(mock.db) });
  assert.equal(first.status, 502);
  assert.equal(mock.db.rows.get(REQUEST_A).status, 'ambiguous');
  const retry = await mock.handler({ request: request(), env: env(mock.db) });
  assert.equal(retry.status, 502);
  assert.equal(mock.requests.length, 1);
});

test('concurrent requests sharing an ID make at most one provider call', async () => {
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const mock = loadEndpoint({ fetchImpl: async () => { await blocked; return Response.json({ accepted: true }); } });
  const firstPromise = mock.handler({ request: request(), env: env(mock.db) });
  await new Promise(resolve => setImmediate(resolve));
  const second = await mock.handler({ request: request(), env: env(mock.db) });
  assert.equal(second.status, 409);
  assert.equal(mock.requests.length, 1);
  release();
  const first = await firstPromise;
  assert.equal(first.status, 200);
});

test('FAQ form copy does not promise delivery or imply marketing consent', () => {
  const source = readFileSync(new URL('../src/pages/faq.astro', import.meta.url), 'utf8');
  assert.match(source, /accepted for processing/);
  assert.match(source, /cannot confirm email delivery/);
  assert.match(source, /does not sign you up for ongoing marketing, calls, or text messages/);
  assert.match(source, /Request another copy/);
  assert.match(source, /sessionStorage\.setItem\(requestKey, id\)/);
  assert.match(source, /requestId,/);
  assert.match(source, /const DATE_MODIFIED = '2026-11-22'/);
  assert.doesNotMatch(source, /Your guide is on its way/);
  const endpoint = readFileSync(new URL('../functions/api/faq-lead.ts', import.meta.url), 'utf8');
  assert.match(endpoint, /GHL_FAQ_GUIDE_WEBHOOK_URL/);
  assert.doesNotMatch(endpoint, /GHL_GUIDE_WEBHOOK_URL/);
  assert.doesNotMatch(endpoint, /detected_state/);
});

test('2027 guide separates announcement/effective dates and cites verified official figures', () => {
  const guide = readFileSync(new URL('../src/pages/medicare-at-65-guide.md', import.meta.url), 'utf8');
  for (const text of [
    'November 17, 2026', 'January 1, 2027', '$1,776', '$444', '$888', '$222',
    '$328', '$597', '$209.40', '$292', '$700', '$2,400', '$41.33',
    'October 15 through December 7', 'two full months', 'eight months',
    '2027-medicare-parts-b-premiums-deductibles', '2027-announcement.pdf',
  ]) assert.ok(guide.includes(text), `guide includes ${text}`);
  assert.match(guide, /\[CMS: 2027 Part D base beneficiary premium/);
  assert.match(guide, /general education, not a coverage decision or individualized/i);
});

test('new review PDF is readable and the historical 2026 asset remains byte-for-byte unchanged', () => {
  const oldPdf = readFileSync(new URL('../public/docs/T65-Medicare-Guide-2026.pdf', import.meta.url));
  const draftPdf = readFileSync(new URL('../public/docs/T65-Medicare-Guide-2027.pdf', import.meta.url));
  const currentPdf = readFileSync(new URL('../public/docs/T65-Medicare-Guide.pdf', import.meta.url));
  assert.equal(createHash('sha256').update(oldPdf).digest('hex'), 'e281bf8637cccbc3d390bdb579856b7f33c7b2c54c2cc034b27d61a82670a83a');
  assert.equal(draftPdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(draftPdf.byteLength > 10000);
  assert.equal(draftPdf.toString('latin1').match(/\/Type \/Page\b/g)?.length, 10, 'layout-tool guide uses the validated ten-page layout');
  assert.deepEqual(currentPdf, draftPdf, 'yearless current PDF serves the reviewed 2027 file byte-for-byte');
  assert.equal(createHash('sha256').update(currentPdf).digest('hex'), createHash('sha256').update(draftPdf).digest('hex'));
});

test('yearless online guide exposes working source links and the current printable PDF', () => {
  const guide = readFileSync(new URL('../src/pages/medicare-at-65-guide.md', import.meta.url), 'utf8');
  assert.match(guide, /path: \/medicare-at-65-guide\//);
  assert.match(guide, /datePublished: 2026-11-22[\s\S]*dateModified: 2026-11-22/);
  assert.match(guide, /\[Download the printable 2027 guide \(PDF\)\]\(\/docs\/T65-Medicare-Guide\.pdf\)/);
  assert.match(guide, /\[CMS: 2027 Medicare Parts A and B premiums and deductibles/);
  assert.match(guide, /\[Medicare\.gov: Part D costs/);
  assert.match(guide, /\[SSA: Medicare IRMAA/);
  assert.match(guide, /\[TRICARE: Medicare and TRICARE For Life/);
  assert.match(readFileSync(new URL('../docs/guide-delivery/2027-turning-65-guide.txt', import.meta.url), 'utf8'), /https:\/\/www\.cms\.gov\/newsroom\/fact-sheets\/2027-medicare-parts-b-premiums-deductibles/);
});
