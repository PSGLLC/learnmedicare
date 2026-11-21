import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

test('lead endpoints keep out-of-state exclusions server-side and do not forward excluded submissions', () => {
  for (const path of ['functions/api/lead.ts', 'functions/api/guide-lead.ts', 'functions/api/faq-lead.ts']) {
    const source = readFileSync(path, 'utf8');
    const exclusion = source.indexOf('if (targeting.shouldExcludeFromLeadCapture)');
    const forward = source.indexOf('const delivered = await forwardToGHL(');
    assert.ok(exclusion >= 0, `${path} applies visitor targeting`);
    assert.ok(forward > exclusion, `${path} checks targeting before delivery`);
    assert.match(source.slice(exclusion, forward), /excluded: true/);
  }
});
