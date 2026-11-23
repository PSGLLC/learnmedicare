import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { renderMedicareGuideTemplate } from '../src/lib/medicareGuideFacts.mjs';

const root = new URL('../', import.meta.url);
const facts = JSON.parse(readFileSync(new URL('src/data/medicare-guide-facts.json', root), 'utf8'));
const template = readFileSync(new URL('docs/guide-delivery/medicare-at-65-guide.template.md', root), 'utf8');
const markdown = renderMedicareGuideTemplate(template, facts);
const currentBytes = readFileSync(new URL('public/docs/T65-Medicare-Guide.pdf', root));
const datedBytes = readFileSync(new URL(`public/docs/T65-Medicare-Guide-${facts.coverageYear}.pdf`, root));

function words(value) {
  return value.normalize('NFKD').toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function plainMarkdown(value) {
  return value
    .replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/^\|\s*:?-{3,}:?\s*(?:\|.*)?$/gm, '')
    .replace(/\|/g, ' ')
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ');
}

test('yearless and dated PDFs are generated identically from the online guide source', async () => {
  assert.deepEqual(currentBytes, datedBytes);
  assert.equal(facts.pdfCoverageYear, facts.coverageYear);
  const document = await pdfjs.getDocument({ data: new Uint8Array(currentBytes) }).promise;
  assert.equal(document.numPages, facts.pdfPageCount);

  const extractedPages = [];
  const links = new Set();
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const annotations = await page.getAnnotations();
    const pageText = content.items.map((item) => item.str).join(' ');
    extractedPages.push(pageText);
    assert.ok(pageText.length > 100, `page ${pageNumber} contains readable text`);
    assert.ok(Math.abs(page.view[2] - 391.68) < 1, `page ${pageNumber} uses the approved 5.44-inch page width`);
    for (const item of content.items) {
      const x = item.transform[4];
      const y = item.transform[5];
      assert.ok(x >= -1 && x + item.width <= page.view[2] + 2, `text stays within page ${pageNumber} horizontal bounds: ${item.str}`);
      assert.ok(y >= -1 && y <= page.view[3] + 1, `text stays within page ${pageNumber} vertical bounds: ${item.str}`);
    }
    for (const annotation of annotations) if (annotation.url) links.add(annotation.url);
  }

  assert.doesNotMatch(markdown, /editorial review/i, 'reader-facing guide omits internal editorial-review wording');
  assert.doesNotMatch(extractedPages.join(' '), /editorial review/i, 'PDF omits internal editorial-review wording');
  const pageTwo = extractedPages[1].replace(/\s+/g, ' ');
  const pageThree = extractedPages[2].replace(/\s+/g, ' ');
  assert.doesNotMatch(pageTwo, /Enrollment through current employment/, 'the employment SEP heading is not stranded at the end of page 2');
  assert.match(pageThree, /Enrollment through current employment.*current employment/, 'page 3 keeps the SEP heading with its explanation');
  const sourcePage = (extractedPages.find((page) => page.includes('Official sources')) ?? '').replace(/\s+/g, ' ');
  assert.match(sourcePage, /TRICARE: Medicare and TRICARE For Life/, 'the source heading and full citation list remain together');

  const pdfWords = words(extractedPages.join(' '));
  let cursor = 0;
  for (const sourceWord of words(plainMarkdown(markdown))) {
    const found = pdfWords.indexOf(sourceWord, cursor);
    assert.notEqual(found, -1, `PDF retains source word in order: ${sourceWord}`);
    cursor = found + 1;
  }
  for (const source of Object.values(facts.sources)) assert.ok(links.has(source.url), `PDF has a clickable citation to ${source.url}`);
  assert.ok(links.has('https://learnmedicare.org/medicare-at-65-guide/'), 'the PDF link back to the online guide is clickable');
  assert.ok(links.has('https://host.safemsngr.com/widget/booking/8IOq6stkuqzk1H2VKRcS'), 'the consultation link is clickable');
  assert.ok(links.has('mailto:hello@priceservicesgroup.com'), 'the email contact link is clickable');
  assert.ok(currentBytes.toString('latin1').includes('/FontFile2'), 'the PDF embeds the Open Sans font program');
  assert.equal(createHash('sha256').update(currentBytes).digest('hex'), facts.design.exportedPdfSha256);
});
