import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertLeadResponse } from '../src/lib/leadResponse';

test('excluded submissions never qualify as delivered leads', () => {
  assert.throws(() => assertLeadResponse(true, { ok: true, excluded: true }), /not submitted/);
  assert.throws(() => assertLeadResponse(true, { ok: false, excluded: true }), /not submitted/);
});

test('successful and disqualified responses retain existing handling', () => {
  assert.doesNotThrow(() => assertLeadResponse(true, { ok: true }));
  assert.doesNotThrow(() => assertLeadResponse(true, { ok: true, excluded: false }));
});

test('failed delivery and malformed responses do not qualify', () => {
  assert.throws(() => assertLeadResponse(false, { ok: true }), /Something went wrong/);
  assert.throws(() => assertLeadResponse(true, {}), /Something went wrong/);
  assert.throws(() => assertLeadResponse(true, { ok: false, error: 'Delivery failed' }), /Delivery failed/);
});

test('all three course forms check responses before conversion side effects', () => {
  const source = readFileSync('src/pages/course.astro', 'utf8');
  const handlers = source.split('<script>').filter(block => block.includes("fetch('/api/course-lead'") || block.includes("fetch('/api/email-course-lead'"));
  assert.equal(handlers.length, 3);
  for (const handler of handlers) {
    const check = handler.indexOf('assertLeadResponse(res.ok, data)');
    assert.ok(check >= 0);
    assert.ok(check < handler.indexOf("fbq?.('track', 'Lead'"));
    assert.ok(check < handler.indexOf("document.cookie = 'course_unlocked=1"));
  }
});
