import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

test('llms.txt lists existing canonical education pages with Markdown links', () => {
  const text = readFileSync(new URL('../public/llms.txt', import.meta.url), 'utf8');
  assert.match(text, /^# Learn Medicare/m);
  const urls = [...text.matchAll(/\]\((https:\/\/learnmedicare.org[^)]+)\)/g)].map(m => m[1]);
  assert.ok(urls.length >= 14);
  for (const url of urls) {
    const path = new URL(url).pathname;
    assert.ok(existsSync(new URL(`../dist${path.endsWith('/') ? path + 'index.html' : path}`, import.meta.url)), url);
  }
});
