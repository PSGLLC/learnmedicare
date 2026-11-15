import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync(new URL('../src/components/StickyGuideCTA.astro', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

function luminance(hex) {
  const channels = hex.match(/[\da-f]{2}/gi).map((channel) => parseInt(channel, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test('sticky guide CTA label meets AA contrast in both themes and interaction states', () => {
  const fills = [...globalStyles.matchAll(/--fill-teal:\s*(#[\da-f]{6})/gi)].map((match) => match[1]);
  assert.equal(fills.length, 2, 'light and dark theme teal tokens should both be present');
  assert.match(component, /\.sgc-btn\s*\{[^}]*color:\s*#1a0a2e;/s);
  assert.match(component, /\.sgc-btn:hover\s*\{[^}]*transform:/);
  assert.match(component, /\.sgc-btn:focus-visible\s*\{[^}]*outline:\s*3px solid #fff;[^}]*outline-offset:\s*3px;/s);

  for (const fill of fills) {
    assert.ok(contrast('#1a0a2e', fill) >= 4.5, `label contrast on ${fill} should be at least 4.5:1`);
  }

  const accent = globalStyles.match(/--fill-accent:\s*(#[\da-f]{6})/i)?.[1];
  assert.ok(accent, 'CTA container accent token should be present');
  assert.ok(contrast('#ffffff', accent) >= 4.5, 'focus outline should contrast with the CTA container');
});
