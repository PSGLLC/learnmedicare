// Mobile layout guards for Learn Medicare: the header must fit on small phones (320-360px).
// Run after a build:  npm run build && node --test tests/mobileLayout.test.mjs
// Static CSS guards always run. Viewport tests need dist/ + puppeteer-core + Chrome (see tests/helpers/viewport.mjs)
// and are skipped, with the reason, when those aren't available.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WIDTHS, setup, docWidth } from './helpers/viewport.mjs';

const nav = readFileSync(new URL('../src/components/Nav.astro', import.meta.url), 'utf8');

test('css: small-phone header rules exist (smaller logo/wordmark, tighter gaps, 1rem side padding)', () => {
  const m = nav.match(/@media \(max-width: 420px\) \{[\s\S]*?\n  \}/);
  assert.ok(m, '420px media query not found');
  for (const rule of [/\.nav-inner \{ padding-inline: 1rem; \}/, /\.brand img \{ height: 28px; \}/, /\.brand-name \{ font-size: 0\.85rem;/, /\.nav-right \{ gap: 0;/]) assert.match(m[0], rule);
});

test('css: header buttons are 44px on the phone/tablet header', () => {
  const m = nav.match(/@media \(max-width: 980px\) \{\s*\.theme-toggle \{ width: 44px; height: 44px; \}[\s\S]*?\n  \}/);
  assert.ok(m, '44px touch-target block not found');
  assert.match(m[0], /\.nav-toggle \{ width: 44px; height: 44px;/);
  assert.match(readFileSync(new URL('../src/components/SearchModal.astro', import.meta.url), 'utf8'), /max-width: 980px\)\{ \.search-toggle-btn\{width:44px;height:44px\}/);
});

const env = await setup();
const skip = env.skip;
test.after(async () => { if (env.close) await env.close(); });

for (const path of ['/', '/guide/', '/agent-resources/', '/blog/', '/calculators/', '/blog/medicare-advantage-vs-medigap/']) for (const w of WIDTHS) {
  test(`${path} @${w}px: page is not wider than the device`, { skip }, async () => {
    const sw = await env.at(path, w, docWidth);
    assert.ok(sw <= w + 1, `document is ${sw}px wide at ${w}px`);
  });
  test(`${path} @${w}px: header content fits inside the header`, { skip }, async () => {
    const r = await env.at(path, w, () => { const n = document.querySelector('.nav-inner'); return { client: n.clientWidth, scroll: n.scrollWidth }; });
    assert.ok(r.scroll <= r.client + 1, `header content is ${r.scroll}px in a ${r.client}px box`);
  });
}

for (const w of WIDTHS) {
  test(`/ @${w}px: theme, search and menu buttons are at least 44x44`, { skip }, async () => {
    const r = await env.at('/', w, () => ['#theme-toggle', '#search-toggle', '#nav-toggle'].map((s) => { const b = document.querySelector(s).getBoundingClientRect(); return [s, Math.round(b.width), Math.round(b.height)]; }));
    for (const [s, bw, bh] of r) assert.ok(bw >= 44 && bh >= 44, `${s} is ${bw}x${bh}`);
  });
  test(`/agent-resources/ @${w}px: analytics-choice panel stays inside the screen`, { skip }, async () => {
    const r = await env.at('/agent-resources/', w, () => { const b = document.querySelector('#visitor-analytics-choice').getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; });
    assert.ok(r[0] >= 0 && r[1] <= w + 1, `panel spans ${r[0]}..${r[1]} at ${w}px`);
  });
}

// The small-phone header rules reach 420px: at 390-400px the three 44px buttons otherwise fill the header and the
// menu button touches the screen edge (0px at 390px, 3px at 393px). Normal is 16px or more; require at least 12px.
for (const w of [375, 390, 393, 400, 420, 430]) {
  test(`/ @${w}px: menu button keeps a gap to the right screen edge`, { skip }, async () => {
    const gap = await env.at('/', w, () => { const t = document.getElementById('nav-toggle').getBoundingClientRect(); return Math.round(innerWidth - t.right); });
    assert.ok(gap >= 12, `menu button is ${gap}px from the right edge at ${w}px`);
  });
}
