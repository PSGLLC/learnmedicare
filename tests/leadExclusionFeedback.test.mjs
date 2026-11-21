import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import vm from 'node:vm';

test('lead response helper rejects excluded requests before success can be shown', () => {
  const source = readFileSync('src/lib/leadResponse.ts', 'utf8');
  const excludedCheck = source.indexOf('if (data.excluded)');
  const successfulResponseCheck = source.indexOf('if (!httpOk || !data.ok)');

  assert.ok(excludedCheck >= 0, 'excluded responses are explicitly recognized');
  assert.ok(successfulResponseCheck > excludedCheck, 'excluded responses are rejected before generic success handling');
  assert.match(source, /Your request was not submitted/);
});

test('homepage, guide, and FAQ forms reject excluded leads before success or conversion side effects', () => {
  const cases = [
    ['src/pages/index.astro', "fetch('/api/lead'", "form.hidden = true"],
    ['src/pages/guide.astro', "fetch('/api/guide-lead'", "form.hidden = true"],
    ['src/pages/faq.astro', "fetch('/api/faq-lead'", "form.hidden = true"],
  ];

  for (const [path, endpoint, successMarker] of cases) {
    const source = readFileSync(path, 'utf8');
    const handler = source.split('<script>').find(block => block.includes(endpoint));
    assert.ok(handler, `${path} contains its expected endpoint handler`);
    const responseCheck = handler.indexOf('assertLeadResponse(res.ok, data)');
    assert.ok(responseCheck >= 0, `${path} rejects excluded responses`);
    assert.ok(responseCheck < handler.indexOf(successMarker), `${path} checks before showing success`);
    const conversion = handler.indexOf("fbq?.('track', 'Lead'");
    if (conversion >= 0) assert.ok(responseCheck < conversion, `${path} checks before conversion tracking`);
  }
});

test('the homepage guide request remains available outside the insurance footprint', async () => {
  const entry = new URL('../functions/api/lead.ts', import.meta.url).pathname;
  const code = buildSync({ entryPoints:[entry], bundle:true, platform:'node', format:'cjs', write:false }).outputFiles[0].text;
  const requests = [];
  const context = { module:{ exports:{} }, Request, Response, URL,
    fetch:async (url, init) => { requests.push({ url:String(url), body:JSON.parse(init.body) }); return Response.json({ ok:true }); } };
  vm.runInNewContext(code, context);
  const request = new Request('https://learnmedicare.org/api/lead', {
    method:'POST', headers:{ 'Content-Type':'application/json', 'CF-IPRegion':'CA' },
    body:JSON.stringify({ first_name:'Reader', last_name:'Example', email:'reader@example.invalid', status:'turning-65', occupation:'retired', tcpaConsent:true }),
  });
  const response = await context.module.exports.onRequestPost({ request, env:{ GHL_WEB_LEAD_WEBHOOK_URL:'https://ghl.invalid/guide', AGENT_GATE_DISABLED:'true' } });
  assert.equal(response.status, 200);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.detected_state, 'CA');
  assert.equal('residence_state' in requests[0].body, false);
});
