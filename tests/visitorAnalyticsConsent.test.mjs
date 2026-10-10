import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync('public/js/visitor-analytics-consent.js', 'utf8');
function setup(stored, blocked = false) {
  const handlers = {};
  const scripts = [];
  const panel = { hidden: true, querySelector: () => ({ focus() {} }) };
  const buttons = ['allow', 'decline'].map(value => ({ dataset: { analyticsChoice: value }, addEventListener: (_, fn) => { handlers[value] = fn; } }));
  const window = {};
  let saved = stored;
  const context = {
    window, Date,
    localStorage: { getItem: () => { if (blocked) throw Error(); return saved; }, setItem: (_, value) => { if (blocked) throw Error(); saved = value; } },
    document: {
      getElementById: id => id === 'visitor-analytics-choice' ? panel : { addEventListener: (_, fn) => { handlers.preferences = fn; } },
      querySelectorAll: () => buttons,
      createElement: () => ({}), body: { appendChild: script => scripts.push(script) },
    },
  };
  vm.runInNewContext(source, context);
  return { window, panel, scripts, handlers };
}
test('no decision and malformed storage do not load tracking', () => {
  for (const stored of [null, '{bad', '{"analytics":"true"}']) {
    const result = setup(stored);
    assert.equal(result.scripts.length, 0);
    assert.equal(result.panel.hidden, false);
  }
});
test('allow loads once and decline disables the tracker consent signal', () => {
  const result = setup(null);
  result.handlers.allow(); result.handlers.allow();
  assert.equal(result.scripts.length, 1);
  assert.equal(result.window.__psgConsent.analytics, true);
  result.handlers.decline();
  assert.equal(result.window.__psgConsent.analytics, false);
  result.handlers.preferences();
  assert.equal(result.panel.hidden, false);
});
test('saved decisions and marketing preferences are respected', () => {
  const allow = setup('{"analytics":true,"marketing":false}');
  assert.equal(allow.scripts.length, 1);
  assert.equal(allow.window.__psgConsent.marketing, false);
  assert.equal(allow.panel.hidden, true);
  assert.equal(setup('{"analytics":false}').scripts.length, 0);
});
test('blocked storage still permits an explicit session choice', () => {
  const result = setup(null, true);
  assert.equal(result.scripts.length, 0);
  result.handlers.allow();
  assert.equal(result.scripts.length, 1);
});
