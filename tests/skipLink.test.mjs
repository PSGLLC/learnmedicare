import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

for (const layout of ['BaseLayout', 'MinimalLayout']) {
  test(`${layout} starts with a skip link to a focusable main landmark`, () => {
    const source = readFileSync(new URL(`../src/layouts/${layout}.astro`, import.meta.url), 'utf8');
    assert.match(source, /<body>\s*<a class="skip-link" href="#main">Skip to main content<\/a>/);
    assert.match(source, /<main id="main" tabindex="-1">/);
  });
}
