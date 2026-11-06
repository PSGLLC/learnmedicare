// The minimal footer (used by /course/ and /glossary/) links to the existing Privacy Policy and Terms of Use pages,
// like the full footer does. Technical link only: no policy wording is changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const f = readFileSync(new URL('../src/components/MinimalCompliance.astro', import.meta.url), 'utf8');
test('minimal footer links to /privacy and /terms', () => {
  assert.match(f, /<a href="\/privacy">Privacy Policy<\/a>/);
  assert.match(f, /<a href="\/terms">Terms of Use<\/a>/);
});
test('the linked pages exist', () => {
  assert.ok(existsSync(new URL('../src/pages/privacy.astro', import.meta.url)));
  assert.ok(existsSync(new URL('../src/pages/terms.astro', import.meta.url)));
});
