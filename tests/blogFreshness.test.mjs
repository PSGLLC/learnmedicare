import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('AEP review guidance reflects the open 2026 enrollment window and 2027 plan year', () => {
  const guide = read('../src/content/blog/aep-2026-guide.md');
  const partD = read('../src/content/blog/review-part-d-formulary-aep-2026.md');
  assert.match(guide, /During AEP/);
  assert.match(guide, /Plan Year 2027/);
  assert.doesNotMatch(guide, /before AEP opens/i);
  assert.match(partD, /\$2,400/);
  assert.match(partD, /\$700/);
  assert.match(partD, /2027-announcement\.pdf/);
});

test('Medicare Advantage is described as a way to receive Medicare benefits, not as replacement of Medicare', () => {
  const source = read('../src/content/blog/medicare-advantage-vs-medigap.md');
  assert.match(source, /alternative way to receive your Medicare Part A and Part B benefits/);
  assert.doesNotMatch(source, /Medicare Advantage \*\*replaces\*\* Original Medicare/);
});
