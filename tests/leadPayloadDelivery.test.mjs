import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import vm from 'node:vm';

function loadEndpoint(file, { webhookStatus = 200 } = {}) {
  const entry = new URL(`../functions/api/${file}.ts`, import.meta.url).pathname;
  const code = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
  const requests = [];
  const context = {
    module: { exports: {} }, Request, Response, URL,
    console: { error() {}, log() {}, warn() {} },
    fetch: async (url, init = {}) => {
      let body = init.body;
      if (typeof body === 'string') body = JSON.parse(body);
      requests.push({ url: String(url), body });
      return Response.json({ accepted: true }, { status: webhookStatus });
    },
  };
  vm.runInNewContext(code, context);
  return { requests, handler: context.module.exports.onRequestPost };
}

function makeRequest(path, body, detectedState = 'CA') {
  const headers = { 'Content-Type': 'application/json' };
  if (detectedState) headers['CF-IPRegion'] = detectedState;
  return new Request(`https://learnmedicare.org${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

test('Learn homepage lead forwards all collected contact, source, status, and required-consent evidence', async () => {
  const mock = loadEndpoint('lead');
  const request = makeRequest('/api/lead', {
    first_name: 'Synthetic', last_name: 'Reader', email: 'reader@example.invalid', phone: '9105550100',
    status: 'turning-65', occupation: 'retired', pagePath: '/', tcpaConsent: true,
  });
  const response = await mock.handler({ request, env: { GHL_WEB_LEAD_WEBHOOK_URL: 'https://ghl.invalid/fixture', AGENT_GATE_DISABLED: 'true' } });
  assert.equal(response.status, 200);
  assert.equal(mock.requests.length, 1);
  const payload = mock.requests[0].body;
  assert.equal(payload.first_name, 'Synthetic');
  assert.equal(payload.last_name, 'Reader');
  assert.equal(payload.email, 'reader@example.invalid');
  assert.equal(payload.phone, '9105550100');
  assert.equal(payload.tag_status, 'turning-65');
  assert.equal(payload.source, 'learnmedicare');
  assert.equal(payload.pagePath, '/');
  assert.equal(payload.tcpaConsent, true);
  assert.equal(payload.tcpaConsentTimestamp, payload.submittedAt);
  assert.match(payload.submittedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(payload.detected_state, 'CA');
  assert.equal('residence_state' in payload, false, 'educational guide access remains separate from insurance residence eligibility');
});

test('Learn email-course lead forwards the required consent evidence and source page', async () => {
  const mock = loadEndpoint('email-course-lead');
  const request = makeRequest('/api/email-course-lead', {
    first_name: 'Synthetic', email: 'reader@example.invalid', occupation: 'retired',
    pagePath: '/course/', tcpaConsent: true,
  });
  const response = await mock.handler({ request, env: { GHL_WEB_LEAD_WEBHOOK_URL: 'https://ghl.invalid/fixture', AGENT_GATE_DISABLED: 'true' } });
  assert.equal(response.status, 200);
  const payload = mock.requests[0].body;
  assert.equal(payload.first_name, 'Synthetic');
  assert.equal(payload.email, 'reader@example.invalid');
  assert.equal(payload.source, 'learnmedicare-email-course');
  assert.equal(payload.pagePath, '/course/');
  assert.equal(payload.tcpaConsent, true);
  assert.equal(payload.tcpaConsentTimestamp, payload.submittedAt);
});

test('Learn endpoints do not report webhook delivery when the receiving endpoint rejects the payload', async () => {
  for (const file of ['lead', 'email-course-lead']) {
    const mock = loadEndpoint(file, { webhookStatus: 503 });
    const body = file === 'lead'
      ? { first_name: 'Synthetic', last_name: 'Reader', email: 'reader@example.invalid', status: 'turning-65', occupation: 'retired', tcpaConsent: true }
      : { first_name: 'Synthetic', email: 'reader@example.invalid', occupation: 'retired', tcpaConsent: true };
    const response = await mock.handler({
      request: makeRequest(`/api/${file}`, body),
      env: { GHL_WEB_LEAD_WEBHOOK_URL: 'https://ghl.invalid/fixture', AGENT_GATE_DISABLED: 'true' },
    });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).ok, false);
  }
});
