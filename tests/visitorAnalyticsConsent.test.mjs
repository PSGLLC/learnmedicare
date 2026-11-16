import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync('public/js/visitor-analytics-consent.js', 'utf8');
const consentComponent = readFileSync('src/components/VisitorAnalyticsConsent.astro', 'utf8');
test('consent behavior remains available from a deferred same-origin script', () => {
  assert.match(consentComponent, /src="\/js\/visitor-analytics-consent\.js" defer/);
});
function setup(stored, blocked = false) {
  const handlers = {};
  const scripts = [];
  const panel = { hidden: true, querySelector: () => ({ focus() {} }) };
  const preferenceTrigger = {
    addEventListener: (_, fn) => { handlers.preferences = fn; },
    setAttribute() {},
    focus() {},
  };
  const buttons = ['allow', 'decline'].map(value => ({ dataset: { analyticsChoice: value }, addEventListener: (_, fn) => { handlers[value] = fn; } }));
  const marketingButtons = ['allow', 'decline'].map(value => ({ dataset: { marketingChoice: value }, addEventListener: (_, fn) => { handlers['marketing-' + value] = fn; } }));
  const window = { location: { reload() { window.reloaded = true; } }, __loadMarketing() { window.marketingLoads = (window.marketingLoads || 0) + 1; } };
  let saved = stored;
  const context = {
    window, Date,
    localStorage: { getItem: () => { if (blocked) throw Error(); return saved; }, setItem: (_, value) => { if (blocked) throw Error(); saved = value; } },
    document: {
      getElementById: id => id === 'visitor-analytics-choice' ? panel : preferenceTrigger,
      querySelectorAll: selector => selector.includes('marketing') ? marketingButtons : buttons,
      addEventListener() {},
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
  assert.equal(result.window.reloaded, true);
  result.handlers.preferences();
  assert.equal(result.panel.hidden, false);
});
test('marketing requires its own explicit choice and withdrawal reloads', () => {
  const result = setup(null);
  result.handlers.allow();
  assert.equal(result.window.marketingLoads, undefined);
  result.handlers['marketing-allow']();
  assert.equal(result.window.marketingLoads, 1);
  result.handlers['marketing-decline']();
  assert.equal(result.window.__psgConsent.marketing, false);
  assert.equal(result.window.reloaded, true);
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

test('Escape closes preferences without saving or changing consent and restores trigger focus', () => {
  const handlers = {};
  const attrs = {};
  let writes = 0;
  let focused = '';
  const firstChoice = { focus() { focused = 'first-choice'; } };
  const panel = { hidden: true, querySelector() { return firstChoice; } };
  const preferences = {
    addEventListener(type, fn) { handlers[`preferences:${type}`] = fn; },
    setAttribute(name, value) { attrs[name] = value; },
    focus() { focused = 'preferences'; },
  };
  const document = {
    getElementById(id) { return id === 'visitor-analytics-choice' ? panel : preferences; },
    querySelectorAll() { return []; },
    addEventListener(type, fn) { handlers[`document:${type}`] = fn; },
    createElement() { return {}; },
    body: { appendChild() {} },
  };
  const window = { __psgConsent: null };
  const localStorage = { getItem() { return null; }, setItem() { writes += 1; } };
  vm.runInNewContext(source, { document, window, localStorage, Date, JSON, Object });

  assert.equal(panel.hidden, false);
  assert.equal(attrs['aria-expanded'], 'true');
  const consentBeforeEscape = window.__psgConsent;
  let prevented = false;
  handlers['document:keydown']({ key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(panel.hidden, true);
  assert.equal(attrs['aria-expanded'], 'false');
  assert.equal(focused, 'preferences');
  assert.equal(writes, 0);
  assert.equal(window.__psgConsent, consentBeforeEscape);

  handlers['preferences:click']();
  assert.equal(panel.hidden, false);
  assert.equal(attrs['aria-expanded'], 'true');
  assert.equal(focused, 'first-choice');
  assert.equal(writes, 0);
});

test('preferences remain nonmodal and the trigger identifies the expandable section', () => {
  assert.match(consentComponent, /<section id="visitor-analytics-choice" aria-label="Privacy preferences" hidden>/);
  assert.doesNotMatch(consentComponent, /aria-modal|role="dialog"/);
  assert.match(consentComponent, /id="visitor-analytics-preferences"[^>]*aria-controls="visitor-analytics-choice"[^>]*aria-expanded="false"/);
});
