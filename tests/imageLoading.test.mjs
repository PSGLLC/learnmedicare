import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

test('advisor portrait hints match the existing 220-to-320 pixel CSS width', () => {
  const page = readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
  assert.match(page, /widths=\{\[220, 320, 440, 640, 800\]\}/);
  assert.match(page, /sizes="\(max-width: 1000px\) 220px, \(max-width: 1454px\) 22vw, 320px"/);
  assert.match(page, /loading="lazy" decoding="async"/);
});

test('both layouts use optimized PSG logo icons', () => {
  for (const name of ['BaseLayout', 'MinimalLayout']) {
    const layout = readFileSync(new URL(`../src/layouts/${name}.astro`, import.meta.url), 'utf8');
    assert.match(layout, /rel="icon" type="image\/png" href="\/brand\/favicon-48.png" sizes="48x48"/);
    assert.match(layout, /rel="apple-touch-icon" href="\/brand\/apple-touch-icon-180.png" sizes="180x180"/);
    assert.doesNotMatch(layout, /rel="icon"[^>]*href="\/favicon.ico"/);
  }
  for (const [size, filename] of [[48, 'favicon-48.png'], [180, 'apple-touch-icon-180.png']]) {
    const png = readFileSync(new URL(`../public/brand/${filename}`, import.meta.url));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    assert.ok(png.length < (size === 48 ? 5000 : 20000));
  }
});
