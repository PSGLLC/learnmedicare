import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

test('glossary schema describes visible definitions rather than invented FAQs', () => {
  const html = readFileSync(new URL('../dist/glossary/index.html', import.meta.url), 'utf8');
  const schemas = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  const objects = schemas.flatMap(s => Array.isArray(s) ? s : s['@graph'] || [s]);
  assert.ok(objects.some(s => s['@type'] === 'DefinedTermSet'));
  assert.ok(objects.every(s => s['@type'] !== 'FAQPage'));
});

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
