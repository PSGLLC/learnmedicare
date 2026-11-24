import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const REQUEST_A = 'e1c8f6b5-6827-4b32-9c51-621d6a011d7f';
const REQUEST_B = 'a48f43c4-ef0c-4fb7-b95f-193e2e56d288';
const HASH = 'test-only-key-never-used-in-preview-or-production';
const EMAIL = 'reader@example.invalid';
const CONTACT = { id: 'contact-1', locationId: 'RMrQyYPseTazGPmAynzT', email: EMAIL, firstName: 'Sam' };

function fakeD1({ missingTable = false, initialRows = [] } = {}) {
  const rows = new Map(initialRows.map(([id, value]) => [id, { ...value }]));
  const limits = new Map();
  const statements = [];
  const db = {
    rows, limits, statements,
    prepare(sql) {
      statements.push(sql);
      return { bind(...values) {
        return {
          async run() {
            if (missingTable) throw new Error('no such table');
            if (sql.startsWith('DELETE FROM faq_guide_requests')) {
              const cutoff = values[0];
              for (const [id, row] of rows) if (row.created_at < cutoff) rows.delete(id);
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('DELETE FROM faq_guide_rate_limits')) {
              const cutoff = values[0];
              for (const [key, row] of limits) if (row.bucket_start < cutoff) limits.delete(key);
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('INSERT INTO faq_guide_requests')) {
              const [id, recipientHash, ipHash] = values;
              if (rows.has(id)) throw new Error('UNIQUE constraint failed: request_id');
              if ([...rows.values()].some(row => row.recipient_hash === recipientHash && ['processing', 'ambiguous'].includes(row.status))) {
                throw new Error('UNIQUE constraint failed: faq_guide_recipient_inflight');
              }
              rows.set(id, { status: 'processing', outcome: 'processing', recipient_hash: recipientHash, ip_hash: ipHash, created_at: Math.floor(Date.now() / 1000) });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('UPDATE faq_guide_requests')) {
              const [status, outcome, id] = values;
              if (rows.get(id)?.status === 'processing') rows.set(id, { ...rows.get(id), status, outcome, updated_at: Math.floor(Date.now() / 1000) });
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          },
          async first() {
            if (missingTable) throw new Error('no such table');
            if (sql.startsWith('SELECT outcome FROM faq_guide_requests')) return rows.get(values[0]) ?? null;
            if (sql.startsWith('SELECT status, outcome FROM faq_guide_requests')) {
              return [...rows.values()].find(row => row.recipient_hash === values[0] && ['processing', 'ambiguous'].includes(row.status)) ?? null;
            }
            if (sql.startsWith('INSERT INTO faq_guide_rate_limits')) {
              const [scope, keyHash, bucketStart, maximum] = values;
              const key = `${scope}:${keyHash}:${bucketStart}`;
              const prior = limits.get(key);
              if ((prior?.count ?? 0) >= maximum) return null;
              const row = { scope, key_hash: keyHash, bucket_start: bucketStart, count: (prior?.count ?? 0) + 1 };
              limits.set(key, row);
              return { count: row.count };
            }
            return null;
          },
        };
      } };
    },
  };
  return db;
}

function loadEndpoint({ db = fakeD1(), fetchImpl } = {}) {
  const entry = new URL('../functions/api/faq-lead.ts', import.meta.url).pathname;
  const code = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
  const calls = [];
  const context = {
    module: { exports: {} }, Request, Response, URL, AbortSignal, TextEncoder, crypto: webcrypto,
    fetch: async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const call = { url: parsedUrl.href, pathname: parsedUrl.pathname, searchParams: parsedUrl.searchParams, method: init.method ?? 'GET', headers: init.headers ?? {}, payload: init.body ? JSON.parse(init.body) : undefined };
      calls.push(call);
      if (fetchImpl) return fetchImpl(call, init);
      if (parsedUrl.pathname === '/contacts/lookup') return Response.json({ contacts: [CONTACT] });
      if (parsedUrl.pathname === '/conversations/messages') return Response.json({ messageId: 'message-1', emailMessageId: 'email-message-1', msg: 'Message queued successfully.' });
      if (parsedUrl.pathname === '/contacts/') return Response.json({ contact: { id: 'created-contact' } }, { status: 201 });
      throw new Error(`unexpected mocked path ${parsedUrl.pathname}`);
    },
  };
  vm.runInNewContext(code, context);
  return { handler: context.module.exports.onRequestPost, calls, db };
}

function request(requestId = REQUEST_A, overrides = {}, ip = '192.0.2.25') {
  return new Request('https://learnmedicare.org/api/faq-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://learnmedicare.org', 'cf-connecting-ip': ip },
    body: JSON.stringify({ firstName: 'Submitted', email: EMAIL, requestId, ...overrides }),
  });
}

const env = (db, extra = {}) => ({
  FAQ_GUIDE_REQUESTS: db,
  FAQ_GUIDE_DELIVERY_MODE: 'test',
  FAQ_GUIDE_TEST_RECIPIENT: EMAIL,
  GHL_API_TOKEN: 'mock-token-only',
  FAQ_REQUEST_HASH_KEY: HASH,
  ...extra,
});

test('production defaults stay disabled before any database or GHL request', async () => {
  const mock = loadEndpoint();
  const response = await mock.handler({ request: request(), env: { FAQ_GUIDE_REQUESTS: mock.db, GHL_API_TOKEN: 'not-used' } });
  assert.equal(response.status, 503);
  assert.equal(mock.calls.length, 0);
  assert.equal(mock.db.rows.size, 0);
});

test('live mode fails closed until the direct API sender behavior is confirmed', async () => {
  const mock = loadEndpoint();
  const response = await mock.handler({ request: request(), env: env(mock.db, { FAQ_GUIDE_DELIVERY_MODE: 'live' }) });
  assert.equal(response.status, 503);
  assert.equal(mock.calls.length, 0);
  assert.equal(mock.db.rows.size, 0);
});

test('missing D1, missing hash key, and missing API token fail closed before provider writes', async () => {
  for (const setup of [
    { FAQ_GUIDE_REQUESTS: undefined },
    { FAQ_REQUEST_HASH_KEY: undefined },
    { GHL_API_TOKEN: undefined },
  ]) {
    const mock = loadEndpoint();
    const response = await mock.handler({ request: request(), env: env(mock.db, setup) });
    assert.equal(response.status, 503);
    assert.equal(mock.calls.length, 0);
  }
  const missingTable = loadEndpoint({ db: fakeD1({ missingTable: true }) });
  const missingResponse = await missingTable.handler({ request: request(), env: env(missingTable.db) });
  assert.equal(missingResponse.status, 503);
  assert.equal(missingTable.calls.length, 0);
});

test('one exact location-scoped match sends once without contact mutation and uses approved content', async () => {
  const mock = loadEndpoint();
  const response = await mock.handler({ request: request(), env: env(mock.db) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'queued');
  assert.equal(body.emailDelivered, false);
  assert.deepEqual(mock.calls.map(call => call.pathname), ['/contacts/lookup', '/conversations/messages']);
  assert.equal(mock.calls[0].searchParams.get('locationId'), 'RMrQyYPseTazGPmAynzT');
  assert.equal(mock.calls[0].searchParams.get('email'), EMAIL);
  assert.equal(mock.calls[0].headers.Version, 'v3');
  assert.equal(mock.calls[1].payload.contactId, CONTACT.id);
  assert.equal(mock.calls[1].payload.emailTo, EMAIL);
  assert.equal(mock.calls[1].payload.emailFrom, 'info@priceservicesgroup.com');
  assert.equal(mock.calls[1].payload.status, 'pending');
  assert.equal('replyTo' in mock.calls[1].payload, false, 'the documented API has no Reply-To request field');
  assert.equal('fromName' in mock.calls[1].payload, false, 'the documented API has no From-name request field');
  assert.equal(mock.calls[1].payload.subject, 'Your requested 2027 Medicare at 65 guide');
  assert.match(mock.calls[1].payload.html, /Hello Sam,/);
  assert.match(mock.calls[1].payload.html, /one-time response/);
  assert.match(mock.calls[1].payload.html, /https:\/\/learnmedicare\.org\/medicare-at-65-guide\//);
  assert.match(mock.calls[1].payload.html, /https:\/\/learnmedicare\.org\/docs\/T65-Medicare-Guide\.pdf/);
  assert.equal(mock.db.rows.get(REQUEST_A).outcome, 'queued');
  assert.equal(mock.calls.some(call => call.pathname === '/contacts/' || call.method === 'PUT'), false);
});

test('duplicate exact matches, including across lookup pages, never choose or send', async () => {
  const mock = loadEndpoint({ fetchImpl: async call => {
    if (call.pathname !== '/contacts/lookup') throw new Error('send must be suppressed');
    if (!call.searchParams.has('nextCursor')) return Response.json({ contacts: [CONTACT], nextCursor: 'cursor-2' });
    return Response.json({ contacts: [{ ...CONTACT, id: 'contact-2' }] });
  } });
  const response = await mock.handler({ request: request(), env: env(mock.db) });
  const body = await response.json();
  assert.equal(body.status, 'recipient_needs_help');
  assert.match(body.error, /could not safely match/);
  assert.equal(mock.calls.length, 2);
  assert.equal(mock.calls[1].searchParams.get('nextCursor'), 'cursor-2');
  assert.equal(mock.db.rows.get(REQUEST_A).outcome, 'multiple_matches');
});

test('pagination continues when the first page is empty and finds a single exact contact later', async () => {
  const mock = loadEndpoint({ fetchImpl: async call => {
    if (call.pathname === '/contacts/lookup' && !call.searchParams.has('nextCursor')) return Response.json({ contacts: [], nextCursor: 'page-two' });
    if (call.pathname === '/contacts/lookup') return Response.json({ contacts: [CONTACT] });
    return Response.json({ messageId: 'm-2' });
  } });
  const response = await mock.handler({ request: request(), env: env(mock.db) });
  assert.equal(response.status, 200);
  assert.equal(mock.calls.filter(call => call.pathname === '/contacts/lookup').length, 2);
  assert.equal(mock.calls.at(-1).payload.contactId, CONTACT.id);
});

test('incomplete or looping pagination fails closed without sending', async () => {
  const mock = loadEndpoint({ fetchImpl: async () => Response.json({ contacts: [], nextCursor: 'same' }) });
  const response = await mock.handler({ request: request(), env: env(mock.db) });
  assert.equal(response.status, 503);
  assert.equal(mock.calls.length, 2);
  assert.notEqual(mock.db.rows.get(REQUEST_A).outcome, 'queued');
});

test('lookup results outside the expected location or without an exact email are ignored', async () => {
  const mock = loadEndpoint({ fetchImpl: async call => {
    if (call.pathname !== '/contacts/lookup') throw new Error('must not send');
    return Response.json({ contacts: [
      { ...CONTACT, id: 'wrong-location', locationId: 'other-location' },
      { ...CONTACT, id: 'wrong-email', email: 'other@example.invalid', emailLowerCase: 'other@example.invalid' },
    ] });
  } });
  const response = await mock.handler({ request: request(), env: env(mock.db) });
  assert.equal((await response.json()).status, 'recipient_needs_help');
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.db.rows.get(REQUEST_A).outcome, 'no_match');
});

test('no match does not create a contact or send until the separate creation gate is enabled', async () => {
  const mock = loadEndpoint({ fetchImpl: async call => {
    assert.equal(call.pathname, '/contacts/lookup');
    return Response.json({ contacts: [] });
  } });
  const response = await mock.handler({ request: request(), env: env(mock.db) });
  const body = await response.json();
  assert.equal(body.status, 'recipient_needs_help');
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.db.rows.get(REQUEST_A).outcome, 'no_match');
});

test('the separately gated no-match creation is minimal and a known create failure does not send', async () => {
  const mock = loadEndpoint({ fetchImpl: async call => {
    if (call.pathname === '/contacts/lookup') return Response.json({ contacts: [] });
    if (call.pathname === '/contacts/') return Response.json({ message: 'rejected' }, { status: 400 });
    throw new Error('email send must not occur');
  } });
  const response = await mock.handler({ request: request(), env: env(mock.db, { FAQ_GUIDE_DELIVERY_MODE: 'live', FAQ_GHL_SENDER_BEHAVIOR_CONFIRMED: 'true', FAQ_GHL_CONTACT_CREATION_ENABLED: 'true', FAQ_GHL_CONTACT_CREATED_EFFECTS_APPROVED: 'true' }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'recipient_needs_help');
  assert.deepEqual(mock.calls.map(call => call.pathname), ['/contacts/lookup', '/contacts/']);
  assert.deepEqual(Object.keys(mock.calls[1].payload).sort(), ['email', 'firstName', 'locationId', 'source']);
  assert.equal(mock.calls[1].headers.Version, 'v3');
  assert.equal(mock.db.rows.get(REQUEST_A).outcome, 'contact_creation_failed');
});

test('no-match creation requires both live-mode approval flags and then uses only the new contact ID', async () => {
  const mock = loadEndpoint({ fetchImpl: async call => {
    if (call.pathname === '/contacts/lookup') return Response.json({ contacts: [] });
    if (call.pathname === '/contacts/') return Response.json({ contact: { id: 'new-contact', locationId: 'RMrQyYPseTazGPmAynzT', email: EMAIL } }, { status: 201 });
    if (call.pathname === '/conversations/messages') return Response.json({ messageId: 'm-created' });
    throw new Error(`unexpected path ${call.pathname}`);
  } });
  const liveEnv = env(mock.db, { FAQ_GUIDE_DELIVERY_MODE: 'live', FAQ_GHL_SENDER_BEHAVIOR_CONFIRMED: 'true', FAQ_GHL_CONTACT_CREATION_ENABLED: 'true', FAQ_GHL_CONTACT_CREATED_EFFECTS_APPROVED: 'true' });
  const response = await mock.handler({ request: request(), env: liveEnv });
  assert.equal(response.status, 200);
  assert.deepEqual(mock.calls.map(call => call.pathname), ['/contacts/lookup', '/contacts/', '/conversations/messages']);
  assert.deepEqual(Object.keys(mock.calls[1].payload).sort(), ['email', 'firstName', 'locationId', 'source']);
  assert.equal(mock.calls[2].payload.contactId, 'new-contact');
  assert.equal(mock.calls[2].payload.emailTo, EMAIL);
});

test('a timed-out contact creation is treated as ambiguous and is never repeated', async () => {
  const mock = loadEndpoint({ fetchImpl: async call => {
    if (call.pathname === '/contacts/lookup') return Response.json({ contacts: [] });
    throw new Error('network timeout after possible create');
  } });
  const liveEnv = env(mock.db, { FAQ_GUIDE_DELIVERY_MODE: 'live', FAQ_GHL_SENDER_BEHAVIOR_CONFIRMED: 'true', FAQ_GHL_CONTACT_CREATION_ENABLED: 'true', FAQ_GHL_CONTACT_CREATED_EFFECTS_APPROVED: 'true' });
  const first = await mock.handler({ request: request(), env: liveEnv });
  assert.equal(first.status, 502);
  const repeatSame = await mock.handler({ request: request(), env: liveEnv });
  const repeatNewId = await mock.handler({ request: request(REQUEST_B), env: liveEnv });
  assert.equal(repeatSame.status, 502);
  assert.equal(repeatNewId.status, 502);
  assert.equal(mock.calls.filter(call => call.pathname === '/contacts/').length, 1);
});

test('a successful contact-create response without an ID is ambiguous and not repeated', async () => {
  const mock = loadEndpoint({ fetchImpl: async call => {
    if (call.pathname === '/contacts/lookup') return Response.json({ contacts: [] });
    if (call.pathname === '/contacts/') return Response.json({ contact: {} }, { status: 201 });
    throw new Error('must not send');
  } });
  const liveEnv = env(mock.db, { FAQ_GUIDE_DELIVERY_MODE: 'live', FAQ_GHL_SENDER_BEHAVIOR_CONFIRMED: 'true', FAQ_GHL_CONTACT_CREATION_ENABLED: 'true', FAQ_GHL_CONTACT_CREATED_EFFECTS_APPROVED: 'true' });
  assert.equal((await mock.handler({ request: request(), env: liveEnv })).status, 502);
  assert.equal((await mock.handler({ request: request(REQUEST_B), env: liveEnv })).status, 502);
  assert.equal(mock.calls.filter(call => call.pathname === '/contacts/').length, 1);
});

test('a timed-out send is ambiguous, blocks recipient-level repeats, and is not replayed', async () => {
  const mock = loadEndpoint({ fetchImpl: async call => {
    if (call.pathname === '/contacts/lookup') return Response.json({ contacts: [CONTACT] });
    throw new Error('timeout after possible provider write');
  } });
  const first = await mock.handler({ request: request(), env: env(mock.db) });
  const retrySame = await mock.handler({ request: request(), env: env(mock.db) });
  const later = await mock.handler({ request: request(REQUEST_B), env: env(mock.db) });
  assert.equal(first.status, 502);
  assert.equal(retrySame.status, 502);
  assert.equal(later.status, 502);
  assert.equal(mock.calls.filter(call => call.pathname === '/conversations/messages').length, 1);
});

test('a queued API response is not reported as delivered; repeated request IDs do not send twice', async () => {
  const mock = loadEndpoint();
  const first = await mock.handler({ request: request(), env: env(mock.db) });
  const repeated = await mock.handler({ request: request(), env: env(mock.db) });
  assert.equal((await first.json()).emailDelivered, false);
  assert.equal((await repeated.json()).duplicate, true);
  assert.equal(mock.calls.filter(call => call.pathname === '/conversations/messages').length, 1);
});

test('a deliberate later request with a fresh ID is allowed after a queued send', async () => {
  const mock = loadEndpoint();
  const liveEnv = env(mock.db, { FAQ_GUIDE_DELIVERY_MODE: 'live', FAQ_GHL_SENDER_BEHAVIOR_CONFIRMED: 'true' });
  const first = await mock.handler({ request: request(REQUEST_A), env: liveEnv });
  const later = await mock.handler({ request: request(REQUEST_B), env: liveEnv });
  assert.equal(first.status, 200);
  assert.equal(later.status, 200);
  assert.equal(mock.calls.filter(call => call.pathname === '/conversations/messages').length, 2);
});

test('recipient locking prevents concurrent distinct requests from sending twice', async () => {
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const mock = loadEndpoint({ fetchImpl: async call => {
    if (call.pathname === '/contacts/lookup') {
      await blocked;
      return Response.json({ contacts: [CONTACT] });
    }
    return Response.json({ messageId: 'message-1' });
  } });
  const firstPromise = mock.handler({ request: request(REQUEST_A), env: env(mock.db) });
  await new Promise(resolve => setImmediate(resolve));
  const second = await mock.handler({ request: request(REQUEST_B), env: env(mock.db) });
  assert.equal(second.status, 409);
  release();
  assert.equal((await firstPromise).status, 200);
  assert.equal(mock.calls.filter(call => call.pathname === '/conversations/messages').length, 1);
});

test('contact email suppression is honored and no send is attempted', async () => {
  const mock = loadEndpoint({ fetchImpl: async call => {
    if (call.pathname === '/contacts/lookup') return Response.json({ contacts: [{ ...CONTACT, dndSettings: { email: { status: 'active' } } }] });
    throw new Error('must not send');
  } });
  const response = await mock.handler({ request: request(), env: env(mock.db) });
  assert.equal((await response.json()).status, 'recipient_needs_help');
  assert.equal(mock.calls.some(call => call.pathname === '/conversations/messages'), false);
});

test('recipient and client rate limits are atomically bounded', async () => {
  const mock = loadEndpoint();
  const liveEnv = env(mock.db, { FAQ_GUIDE_DELIVERY_MODE: 'live', FAQ_GHL_SENDER_BEHAVIOR_CONFIRMED: 'true' });
  for (const id of [REQUEST_A, REQUEST_B]) await mock.handler({ request: request(id), env: liveEnv });
  const third = await mock.handler({ request: request('94873fa9-82a1-4b55-a0bb-9309f9a6e3b2'), env: liveEnv });
  const fourth = await mock.handler({ request: request('a47e7eab-8eed-40e1-a254-68d04a85c8bd'), env: liveEnv });
  assert.equal(third.status, 200);
  assert.equal(fourth.status, 429);
  assert.equal(mock.calls.filter(call => call.pathname === '/conversations/messages').length, 3);
});

test('global daily limit bounds distributed requests across distinct recipients and IPs', async () => {
  const mock = loadEndpoint();
  const liveEnv = env(mock.db, { FAQ_GUIDE_DELIVERY_MODE: 'live', FAQ_GHL_SENDER_BEHAVIOR_CONFIRMED: 'true' });
  let lastResponse;
  for (let i = 1; i <= 51; i += 1) {
    const id = `${i.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`;
    const ip = `198.51.${Math.floor(i / 250)}.${(i % 250) + 1}`;
    lastResponse = await mock.handler({ request: request(id, { email: `global${i}@example.invalid` }, ip), env: liveEnv });
  }
  assert.equal(lastResponse.status, 429);
  assert.equal(mock.calls.filter(call => call.pathname === '/contacts/lookup').length, 50);
  assert.equal(mock.calls.some(call => call.pathname === '/conversations/messages'), false);
});

test('wrong origin, bad input, and honeypot do not call GHL', async () => {
  const mock = loadEndpoint();
  const wrongOrigin = new Request('https://learnmedicare.org/api/faq-lead', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example', 'cf-connecting-ip': '192.0.2.25' }, body: JSON.stringify({ firstName: 'A', email: EMAIL, requestId: REQUEST_A }) });
  assert.equal((await mock.handler({ request: wrongOrigin, env: env(mock.db) })).status, 403);
  assert.equal((await mock.handler({ request: request('bad-id'), env: env(mock.db) })).status, 400);
  assert.equal((await mock.handler({ request: request(REQUEST_A, { website: 'bot' }), env: env(mock.db) })).status, 200);
  assert.equal(mock.calls.length, 0);
});

test('test mode is limited to one explicitly configured recipient and cannot create contacts', async () => {
  const mock = loadEndpoint({ fetchImpl: async call => {
    if (call.pathname === '/contacts/lookup') return Response.json({ contacts: [] });
    throw new Error('test mode must not create contacts or send');
  } });
  const outside = await mock.handler({ request: request(REQUEST_A, { email: 'other@example.invalid' }), env: env(mock.db, { FAQ_GHL_CONTACT_CREATION_ENABLED: 'true', FAQ_GHL_CONTACT_CREATED_EFFECTS_APPROVED: 'true' }) });
  assert.equal(outside.status, 503);
  assert.equal(mock.calls.length, 0);
  const noMatch = await mock.handler({ request: request(REQUEST_B), env: env(mock.db, { FAQ_GHL_CONTACT_CREATION_ENABLED: 'true', FAQ_GHL_CONTACT_CREATED_EFFECTS_APPROVED: 'true' }) });
  assert.equal((await noMatch.json()).status, 'recipient_needs_help');
  assert.deepEqual(mock.calls.map(call => call.pathname), ['/contacts/lookup']);
});

test('retention applies to request hashes and rate-limit data', async () => {
  const now = Math.floor(Date.now() / 1000);
  const expired = 'expired';
  const active = 'active';
  const db = fakeD1({ initialRows: [
    [expired, { status: 'accepted', outcome: 'queued', created_at: now - 90 * 24 * 60 * 60 - 1, recipient_hash: 'old', ip_hash: 'old' }],
    [active, { status: 'accepted', outcome: 'queued', created_at: now - 90 * 24 * 60 * 60 + 1, recipient_hash: 'new', ip_hash: 'new' }],
  ] });
  const mock = loadEndpoint({ db });
  await mock.handler({ request: request(), env: env(db) });
  assert.equal(db.rows.has(expired), false);
  assert.equal(db.rows.has(active), true);
  assert.ok(db.statements.some(sql => sql.startsWith('DELETE FROM faq_guide_rate_limits')));
});

test('FAQ keeps direct guide access and the public request form inactive', () => {
  const source = readFileSync(new URL('../src/pages/faq.astro', import.meta.url), 'utf8');
  assert.match(source, /One-time email requests are currently unavailable/);
  assert.match(source, /href="\/medicare-at-65-guide\/"/);
  assert.match(source, /href="\/docs\/T65-Medicare-Guide\.pdf"/);
  assert.doesNotMatch(source, /id="faq-lead-form"/);
  const endpoint = readFileSync(new URL('../functions/api/faq-lead.ts', import.meta.url), 'utf8');
  assert.match(endpoint, /const mode = env\.FAQ_GUIDE_DELIVERY_MODE \?\? "off"/);
  assert.match(endpoint, /mode === "live" && env\.FAQ_GHL_SENDER_BEHAVIOR_CONFIRMED !== "true"/);
  assert.doesNotMatch(endpoint, /GHL_FAQ_GUIDE_WEBHOOK_URL|GHL_GUIDE_WEBHOOK_URL/);
  assert.match(endpoint, /FAQ_GHL_CONTACT_CREATED_EFFECTS_APPROVED/);
});

test('the additive ledger migration stores keyed hashes, not raw recipient or IP values', () => {
  const migration = readFileSync(new URL('../migrations/0002_faq_guide_direct_api.sql', import.meta.url), 'utf8');
  assert.match(migration, /recipient_hash TEXT/);
  assert.match(migration, /ip_hash TEXT/);
  assert.match(migration, /CREATE UNIQUE INDEX/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS faq_guide_rate_limits/);
  assert.match(migration, /global_day/);
  assert.doesNotMatch(migration, /email_address|raw_email|ip_address|request_body/i);
});

test('2027 guide remains accurate and published guide PDF stays the intended asset', () => {
  const guide = readFileSync(new URL('../src/pages/medicare-at-65-guide.md', import.meta.url), 'utf8');
  for (const text of ['November 17, 2026', 'January 1, 2027', '$1,776', '$444', '$888', '$222', '$328', '$597', '$209.40', '$292', '$700', '$2,400', '$41.33']) assert.ok(guide.includes(text));
  const pdf = readFileSync(new URL('../public/docs/T65-Medicare-Guide.pdf', import.meta.url));
  const reviewedPdf = readFileSync(new URL('../public/docs/T65-Medicare-Guide-2027.pdf', import.meta.url));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.deepEqual(pdf, reviewedPdf);
});
