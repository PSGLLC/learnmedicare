import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/guide.astro', import.meta.url), 'utf8');
test('guide required fields are validated before a lead request is constructed', () => {
  const validation = source.indexOf('if (!form.reportValidity()) return;');
  assert.ok(validation > 0);
  assert.ok(validation < source.indexOf('const payload ='));
  assert.match(source, /form\.querySelector<HTMLInputElement>\('#smsOptIn'\)\?\.focus\(\)/);
});
test('guide response messages receive keyboard focus and accessible announcements', () => {
  assert.match(source, /id="guide-form-error"[^>]*role="alert"[^>]*tabindex="-1"/);
  assert.match(source, /id="guide-form-success"[^>]*role="status"[^>]*tabindex="-1"/);
  assert.match(source, /successEl\.hidden = false;\s+successEl\.focus\(\)/);
  assert.match(source, /errorEl\.hidden = false;\s+errorEl\.focus\(\)/);
});
