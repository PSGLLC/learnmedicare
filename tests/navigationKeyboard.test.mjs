import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

test('navigation disclosures have controls and Escape restores the appropriate trigger', () => {
  const nav = readFileSync(new URL('../src/components/Nav.astro', import.meta.url), 'utf8');
  assert.match(nav, /aria-controls="nav-links"/);
  assert.match(nav, /aria-controls="resources-menu"/);
  assert.match(nav, /if \(focusInResources\) \{\s+resourcesToggle\?\.focus\(\);\s+e\.preventDefault\(\);\s+return;/);
  assert.match(nav, /links\.contains\(document\.activeElement\) \|\| document\.activeElement === toggle/);
  assert.match(nav, /toggle\?\.focus\(\)/);
});
