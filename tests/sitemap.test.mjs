import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sitemap = readFileSync(new URL('../dist/sitemap-0.xml', import.meta.url), 'utf8');

test('sitemap excludes the intentionally noindex agent resource page', () => {
  assert.doesNotMatch(sitemap, /<loc>https:\/\/learnmedicare\.org\/agent-resources\/<\/loc>/);
  const page = readFileSync(new URL('../dist/agent-resources/index.html', import.meta.url), 'utf8');
  assert.match(page, /name="robots" content="noindex, nofollow"/);
});

test('sitemap retains public learning and conversion pages', () => {
  for (const path of ['course/', 'guide/', 'basics/', 'course/lesson-1/']) {
    assert.ok(sitemap.includes(`<loc>https://learnmedicare.org/${path}</loc>`), path);
  }
});

test('sitemap does not manufacture content update dates on every build', () => {
  assert.doesNotMatch(sitemap, /<lastmod>/);
});

test('Q&A redirect stays available without indexing hidden FAQ content', () => {
  const html = readFileSync(new URL('../dist/medicare-qa/index.html', import.meta.url), 'utf8');
  assert.match(html, /content="noindex, follow"/);
  assert.doesNotMatch(html, /FAQPage|\$185\.00/);
  assert.doesNotMatch(sitemap, /https:\/\/learnmedicare\.org\/medicare-qa\//);
  assert.ok(html.includes('https://huggingface.co/spaces/PPAKayla/medicare-qa'));
});
