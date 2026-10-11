import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('privacy choices do not push page content when revealed', () => {
  const source = readFileSync('src/components/VisitorAnalyticsConsent.astro', 'utf8');
  assert.match(source, /#visitor-analytics-choice\s*\{[^}]*position:\s*fixed/);
  assert.match(source, /max-height:\s*50svh/);
  assert.match(source, /overflow-y:\s*auto/);
  assert.match(source, /#visitor-analytics-choice\[hidden\]\s*\{\s*display:\s*none/);
});
