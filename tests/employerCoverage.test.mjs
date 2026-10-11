import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('working and glossary content separate Part B and Part D exceptions', () => {
  for (const path of ['glossary', 'working-at-65']) {
    const html = readFileSync(new URL(`../dist/${path}/index.html`, import.meta.url), 'utf8');
    assert.match(html, /current employment/);
    assert.match(html, /COBRA/);
    assert.match(html, /https:\/\/www\.medicare\.gov\/health-drug-plans\/part-d\/basics\/creditable-coverage/);
    assert.doesNotMatch(html, /standard for both medical \(Part B\)/);
    assert.doesNotMatch(html, /any provider that accepts Medicare, anywhere in the country, will treat you/);
  }
});
