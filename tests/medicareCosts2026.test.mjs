import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// CMS's 2026 Part A fact sheet: $1,736 deductible and $311/$565 premiums.
const paths = ['medicare-costs-2026', 'course/lesson-2', 'agent-resources', 'what-is-medicare', 'medicare-vs-medicaid'];

for (const path of paths) {
  test(`${path} renders current Part A costs without stale 2025 figures`, () => {
    const html = readFileSync(new URL(`../dist/${path}/index.html`, import.meta.url), 'utf8');
    assert.ok(html.includes('$1,736'));
    assert.doesNotMatch(html, /\$(?:1,676|285|518)(?!\d)/);
    if (['medicare-costs-2026', 'course/lesson-2', 'agent-resources'].includes(path)) {
      assert.ok(html.includes('$311/month'));
      assert.ok(html.includes('$565/month'));
    }
    if (['medicare-costs-2026', 'course/lesson-2'].includes(path)) {
      assert.ok(html.includes('https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles'));
    }
  });
}
