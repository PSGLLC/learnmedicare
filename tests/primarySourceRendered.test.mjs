import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = (route) => readFileSync(new URL(`../dist${route}index.html`, import.meta.url), 'utf8');

test('generated AEP guide keeps the current window separate from the coverage year', () => {
  const html = page('/blog/aep-2026-guide/');
  assert.match(html, /Plan Year 2027/);
  assert.match(html, /During AEP/);
  assert.match(html, /medicare\.gov\/health-drug-plans\/open-enrollment/);
  assert.doesNotMatch(html, /Before AEP opens/);
});

test('generated Medicare Advantage comparison describes coverage accurately and retains official context', () => {
  const html = page('/blog/medicare-advantage-vs-medigap/');
  assert.match(html, /alternative way to receive your Medicare Part A and Part B benefits/);
  assert.match(html, /medicare\.gov\/basics\/costs\/medicare-costs/);
  assert.doesNotMatch(html, /Medicare Advantage \*\*replaces\*\* Original Medicare/);
});
