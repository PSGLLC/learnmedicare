import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setup } from './helpers/viewport.mjs';

const layout = readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
const faq = readFileSync(new URL('../src/pages/faq.astro', import.meta.url), 'utf8');
const globals = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
const sticky = readFileSync(new URL('../src/components/StickyGuideCTA.astro', import.meta.url), 'utf8');

function luminance(hex) {
  const rgb = hex.replace('#', '').match(/.{2}/g).map(v => parseInt(v, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function contrast(a, b) {
  const l = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l[0] + 0.05) / (l[1] + 0.05);
}

test('FAQ theme overrides are route-scoped and use lavender/white light surfaces with purple dark surfaces', () => {
  assert.match(layout, /<html lang="en" class:list=\{\{ 'page-faq': normalizedPath === '\/faq' \}\}>/);
  assert.match(globals, /html\.page-faq\s*\{[^}]*--bg-primary:\s*#F5F0FA/s);
  assert.match(globals, /html\.page-faq\s*\{[^}]*--bg-card:\s*#FFFFFF/s);
  assert.match(globals, /:root\[data-theme="dark"\]\.page-faq\s*\{[^}]*--bg-primary:\s*#120D1D/s);
  assert.match(globals, /:root\[data-theme="dark"\]\.page-faq\s*\{[^}]*--bg-card:\s*#231A32/s);
  assert.match(faq, /background: var\(--bg-card\)/);
  assert.ok(contrast('#1a0a2e', '#F5F0FA') >= 4.5);
  assert.ok(contrast('#4a3a6e', '#F5F0FA') >= 4.5);
  assert.ok(contrast('#D0C2E0', '#231A32') >= 4.5);
  assert.ok(contrast('#806B93', '#FFFFFF') >= 3, 'light FAQ accordion boundary must meet non-text contrast');
  assert.ok(contrast('#806B93', '#231A32') >= 3, 'dark FAQ accordion boundary must meet non-text contrast');
  assert.ok(contrast('#9A83AD', '#231A32') >= 3, 'dark email input boundary must meet non-text contrast');
  assert.match(globals, /\.page-faq \.page-hero \.eyebrow,[\s\S]*\.page-faq \.page-hero \.author-byline \{ color: #FFFFFF/);
  assert.ok(contrast('#FFFFFF', '#9059B5') >= 4.5, 'FAQ hero text must meet AA at the light end of the gradient');
  assert.ok(contrast('#FFFFFF', '#6d3f8f') >= 4.5, 'FAQ hero text must meet AA at the dark end of the gradient');
  assert.match(globals, /\.page-faq main \{ padding-bottom:/);
  assert.match(globals, /\.page-faq \.faq-section \.container \{ padding-right: 360px; \}/);
  assert.match(globals, /\.page-faq \.sticky-guide-cta \.sgc-text \{ flex: 0 1 36%;/);
  assert.match(sticky, /id="sgc-close"/);
  assert.match(sticky, /href="\/guide\/"/);
});

const env = await setup();
test.after(async () => { if (env.close) await env.close(); });
const skip = env.skip;

for (const [scheme, expected] of [['light', 'rgb(245, 240, 250)'], ['dark', 'rgb(18, 13, 29)']]) {
  for (const width of [320, 390, 430, 1440]) {
    test(`FAQ ${scheme} mode @${width}px: readable surfaces, header, byline, focus and no horizontal overflow`, { skip }, async () => {
      const result = await env.at('/faq/', width, () => {
        document.querySelector('.sticky-guide-cta').classList.add('sgc-visible');
        if (innerWidth <= 900) document.querySelector('.form-submit').scrollIntoView({ block: 'end', behavior: 'instant' });
        const cs = s => getComputedStyle(document.querySelector(s));
        const box = s => { const r = document.querySelector(s).getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width}; };
        const faqCard = document.querySelector('.faq-list details');
        const request = document.querySelector('.request-panel');
        const input = document.querySelector('#faq-email');
        const byline = document.querySelector('.author-byline');
        const navText = document.querySelector('.brand-medicare');
        return {
          theme: document.documentElement.dataset.theme,
          body: cs('body').backgroundColor,
          band: cs('.lead-section').backgroundColor,
          header: cs('.nav-wrap').backgroundColor,
          card: getComputedStyle(faqCard).backgroundColor,
          request: getComputedStyle(request).backgroundColor,
          input: getComputedStyle(input).backgroundColor,
          inputBorder: getComputedStyle(input).borderColor,
          cardBorder: getComputedStyle(faqCard).borderColor,
          text: cs('body').color,
          heading: cs('.page-hero h1').color,
          heroEyebrow: getComputedStyle(document.querySelector('.page-hero .eyebrow')).color,
          heroDescription: getComputedStyle(document.querySelector('.page-hero .subhead')).color,
          byline: getComputedStyle(byline).color,
          navText: getComputedStyle(navText).color,
          focus: cs('#faq-email').outlineStyle,
          focusColor: cs('#faq-email').outlineColor,
          documentWidth: document.documentElement.scrollWidth,
          viewport: innerWidth,
          main: box('main'),
          closeExists: !!document.querySelector('#sgc-close'),
          guideLink: document.querySelector('.sticky-guide-cta a')?.getAttribute('href'),
          ctaHeight: document.querySelector('.sticky-guide-cta').getBoundingClientRect().height,
          faqContentRight: document.querySelector('.faq-list details').getBoundingClientRect().right,
          ctaLeft: document.querySelector('.sticky-guide-cta').getBoundingClientRect().left,
          submitBottom: document.querySelector('.form-submit').getBoundingClientRect().bottom,
          ctaTop: document.querySelector('.sticky-guide-cta').getBoundingClientRect().top,
        };
      }, { colorScheme: scheme, focusSelector: '#faq-email', pressKeys: ['Tab', 'Shift+Tab'] });
      assert.equal(result.theme, scheme);
      assert.equal(result.body, expected);
      assert.equal(result.band, scheme === 'light' ? 'rgb(238, 231, 244)' : 'rgb(27, 20, 40)');
      assert.equal(result.focus, 'solid');
      assert.equal(result.heroEyebrow, 'rgb(255, 255, 255)');
      assert.equal(result.heroDescription, 'rgb(255, 255, 255)');
      assert.equal(result.byline, 'rgb(255, 255, 255)');
      assert.equal(result.documentWidth <= result.viewport + 1, true, `horizontal overflow: ${result.documentWidth} > ${result.viewport}`);
      assert.ok(result.main.width <= result.viewport + 1);
      assert.ok(result.closeExists);
      assert.equal(result.guideLink, '/guide/');
      if (width <= 900) {
        assert.ok(result.ctaHeight <= 72, `mobile CTA should stay compact; got ${result.ctaHeight}px`);
        assert.ok(result.submitBottom <= result.ctaTop, 'form submit control must scroll above the fixed mobile guide CTA');
      }
      else assert.ok(result.faqContentRight <= result.ctaLeft + 1, 'desktop FAQ rows must not extend behind the floating guide CTA');
      if (scheme === 'light') {
        assert.equal(result.card, 'rgb(255, 255, 255)');
        assert.equal(result.request, 'rgb(255, 255, 255)');
        assert.equal(result.input, 'rgb(255, 255, 255)');
        assert.equal(result.inputBorder, 'rgb(138, 114, 154)');
        assert.equal(result.cardBorder, 'rgb(128, 107, 147)');
        assert.ok(contrast('#F5F0FA', '#6d3f8f') >= 4.5, 'FAQ hero byline text must meet AA');
        assert.ok(contrast('#7d47a1', '#FFFFFF') >= 4.5, 'header wordmark text must meet AA');
        assert.equal(result.focusColor, 'rgb(125, 71, 161)');
      } else {
        assert.equal(result.card, 'rgb(35, 26, 50)');
        assert.equal(result.request, 'rgb(35, 26, 50)');
        assert.equal(result.input, 'rgb(35, 26, 50)');
        assert.equal(result.inputBorder, 'rgb(154, 131, 173)');
        assert.equal(result.cardBorder, 'rgb(128, 107, 147)');
        assert.ok(contrast('#D0C2E0', '#231A32') >= 4.5);
        assert.equal(result.focusColor, 'rgb(81, 222, 204)');
      }
    });
  }
}

test('FAQ theme toggle changes the FAQ surfaces and keeps the form and sticky close control usable', { skip }, async () => {
  const r = await env.at('/faq/', 390, async () => {
    document.querySelector('#theme-toggle').click();
    const mode = document.documentElement.dataset.theme;
    const body = getComputedStyle(document.body).backgroundColor;
    const cta = document.querySelector('.sticky-guide-cta');
    cta.classList.add('sgc-visible');
    document.querySelector('#sgc-close').click();
    return {mode, body, stickyHidden:getComputedStyle(cta).display === 'none', dismissed:sessionStorage.getItem('sgcDismissed')};
  }, { colorScheme: 'light' });
  assert.equal(r.mode, 'dark');
  assert.equal(r.body, 'rgb(18, 13, 29)');
  assert.equal(r.stickyHidden, true);
  assert.equal(r.dismissed, '1');
});
