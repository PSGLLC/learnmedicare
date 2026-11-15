import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Medicare blog links readers to sourced policy updates', () => {
  const source = readFileSync(new URL('../src/pages/blog/index.astro', import.meta.url), 'utf8');
  assert.match(source, /href="\/news\/">news page/);
  assert.match(source, /links each summary to its original source/);
});
