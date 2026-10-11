import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

test('reported legacy home URLs redirect permanently to the canonical homepage', () => {
  const redirects = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8')
    .trim().split('\n').map(line => line.trim().split(/\s+/));
  for (const path of ['/home', '/home/']) {
    assert.deepEqual(redirects.find(rule => rule[0] === path), [path, 'https://learnmedicare.org/', '301']);
  }
  assert.equal(redirects.some(rule => rule[0].startsWith('/cdn-cgi/')), false);
});
