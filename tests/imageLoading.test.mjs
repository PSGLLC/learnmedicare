import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

test('advisor portrait hints match the existing 220-to-320 pixel CSS width', () => {
  const page = readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
  assert.match(page, /widths=\{\[220, 320, 440, 640, 800\]\}/);
  assert.match(page, /sizes="\(max-width: 1000px\) 220px, \(max-width: 1454px\) 22vw, 320px"/);
  assert.match(page, /loading="lazy" decoding="async"/);
});
