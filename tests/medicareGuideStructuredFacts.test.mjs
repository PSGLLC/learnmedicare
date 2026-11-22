import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderMedicareGuideTemplate } from '../src/lib/medicareGuideFacts.mjs';

const facts = JSON.parse(readFileSync(new URL('../src/data/medicare-guide-facts.json', import.meta.url), 'utf8'));
const guidePath = new URL('../src/pages/medicare-at-65-guide.md', import.meta.url);
const printSourcePath = new URL('../docs/guide-delivery/2027-turning-65-guide.txt', import.meta.url);
const template = readFileSync(new URL('../docs/guide-delivery/medicare-at-65-guide.template.md', import.meta.url), 'utf8');

test('online guide and Canva review source are generated from the same verified annual facts', () => {
  execFileSync(process.execPath, ['scripts/render-medicare-guide.mjs'], { cwd: new URL('..', import.meta.url) });
  execFileSync(process.execPath, ['scripts/render-guide-review-text.mjs'], { cwd: new URL('..', import.meta.url) });
  const guide = readFileSync(guidePath, 'utf8');
  const printSource = readFileSync(printSourcePath, 'utf8');
  const combined = `${guide}\n${printSource}`;

  assert.equal(guide, renderMedicareGuideTemplate(template, facts));
  assert.match(guide, new RegExp(`dateModified: ${facts.reviewDate}`));
  assert.match(guide, /datePublished: 2026-11-22/, 'first-publication metadata is not changed by the annual-facts renderer');
  assert.match(guide, new RegExp(`During the ${facts.enrollmentYear} AEP[\\s\\S]*January 1, ${facts.coverageYear}`));
  assert.match(guide, new RegExp(`CMS announced the ${facts.coverageYear} amounts on`));
  assert.match(guide, /https:\/\/www\.cms\.gov\/files\/document\/2027-announcement\.pdf/);
  assert.ok(guide.includes(`$${facts.amounts.partD.nationalBaseBeneficiaryPremium.toFixed(2)}`));
  assert.match(combined, /\$1,776/);
  assert.match(combined, /\$444/);
  assert.match(combined, /\$888/);
  assert.match(combined, /\$222/);
  assert.match(combined, /\$328/);
  assert.match(combined, /\$597/);
  assert.match(combined, /\$209\.40/);
  assert.match(combined, /\$292/);
  assert.match(combined, /\$700/);
  assert.match(combined, /\$2,400/);
  assert.match(combined, /\$41\.33/);
  for (const source of Object.values(facts.sources)) assert.ok(guide.includes(source.url), `guide cites ${source.url}`);
  assert.doesNotMatch(guide, /\{\{[^}]+\}\}/, 'all annual template tokens are rendered');
});

test('PDF edition mismatch is disclosed instead of presenting an older file as current', () => {
  const fixture = structuredClone(facts);
  fixture.pdfCoverageYear = facts.coverageYear - 1;
  fixture.pdfPageCount = 4;
  const rendered = renderMedicareGuideTemplate(template, fixture);
  assert.match(rendered, /Download the four-page printable 2026 guide \(PDF\)/);
  assert.match(rendered, /yearless PDF currently contains the 2026 edition, not the 2027 guide/);
  assert.match(rendered, /matching branded PDF must be reviewed and exported before replacing it/);
  assert.doesNotMatch(rendered, /The yearless PDF address serves the current edition/);
});

test('ambiguous source data fails generation instead of rendering partial annual facts', () => {
  const fixture = structuredClone(facts);
  fixture.amounts.irmaa.individualAndJointRows.pop();
  assert.throws(() => renderMedicareGuideTemplate(template, fixture), /IRMAA rows are incomplete or ambiguous/);
});

