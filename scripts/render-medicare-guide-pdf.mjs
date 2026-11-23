import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { renderMedicareGuideTemplate } from '../src/lib/medicareGuideFacts.mjs';

const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const factsPath = path.join(root, 'src/data/medicare-guide-facts.json');
const templatePath = path.join(root, 'docs/guide-delivery/medicare-at-65-guide.template.md');
const facts = JSON.parse(await readFile(factsPath, 'utf8'));
const template = await readFile(templatePath, 'utf8');
const markdown = renderMedicareGuideTemplate(template, facts);

const PAGE = { width: 5.44 * 72, height: 8.5 * 72 };
const MARGIN = 28;
const BODY_WIDTH = PAGE.width - MARGIN * 2;
const BODY_TOP = 95;
const BODY_BOTTOM = PAGE.height - 34;
const PURPLE = '#8050a4';
const PURPLE_DARK = '#49246a';
const TEAL = '#51decc';
const NAVY = '#101d36';
const INK = '#202838';
const LINK = '#315a7a';
const PALE = '#f2edf6';
const RULE = '#d8e3ea';
const FONT_REGULAR = require.resolve('@fontsource/open-sans/files/open-sans-latin-400-normal.woff');
const FONT_BOLD = require.resolve('@fontsource/open-sans/files/open-sans-latin-700-normal.woff');
const LOGO = path.join(root, 'public/brand/psg-logo.png');
const PORTRAIT = path.join(root, 'public/img/headshot.png');

function cleanFrontmatter(source) {
  return source.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/, '');
}

function parseGuide(source) {
  const lines = cleanFrontmatter(source).split(/\r?\n/);
  const blocks = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i].trim();
    if (!line) { i += 1; continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }
    if (line.startsWith('|')) {
      const rawRows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-{3,}:?$/.test(cell))) rawRows.push(cells);
        i += 1;
      }
      if (rawRows.length > 1) blocks.push({ type: 'table', rows: rawRows });
      continue;
    }
    const list = line.match(/^([-*]|\d+\.)\s+(.+)$/);
    if (list) {
      const ordered = /^\d/.test(list[1]);
      const items = [];
      while (i < lines.length) {
        const match = lines[i].trim().match(ordered ? /^(\d+\.)\s+(.+)$/ : /^[-*]\s+(.+)$/);
        if (!match) break;
        items.push({ marker: ordered ? match[1] : '•', text: ordered ? match[2] : match[1] });
        i += 1;
      }
      blocks.push({ type: 'list', items });
      continue;
    }
    const paragraph = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith('|') && !/^([-*]|\d+\.)\s+/.test(lines[i].trim())) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }
  return blocks;
}

function absoluteLink(url) {
  if (url === '/docs/T65-Medicare-Guide.pdf') return 'https://learnmedicare.org/medicare-at-65-guide/';
  if (url.startsWith('/')) return `https://learnmedicare.org${url}`;
  return url;
}

function inlineParts(text) {
  const parts = [];
  const runs = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) runs.push({ text: text.slice(cursor, match.index), options: { font: 'OpenSans' } });
    if (match[1] != null) {
      if (runs.length) parts.push({ type: 'text', runs: [...runs] });
      runs.length = 0;
      parts.push({ type: 'link', text: match[1], url: absoluteLink(match[2]) });
    } else {
      runs.push({ text: match[3], options: { font: 'OpenSansBold' } });
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) runs.push({ text: text.slice(cursor), options: { font: 'OpenSans' } });
  if (runs.length) parts.push({ type: 'text', runs });
  if (!parts.length) return [{ type: 'text', runs: [{ text, options: { font: 'OpenSans' } }] }];
  // Keep sentence punctuation attached to its source link rather than creating
  // a one-character paragraph after a clickable citation.
  const normalized = [];
  for (const part of parts) {
    const textPart = part.type === 'text' ? part.runs.map((run) => run.text).join('') : '';
    const previous = normalized.at(-1);
    if (previous?.type === 'link' && /^\s*[.,;:!?]+\s*$/.test(textPart)) previous.text += textPart.trim();
    else normalized.push(part);
  }
  return normalized;
}

function plainInline(text) {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '');
}

const blocks = parseGuide(markdown);
if (blocks[0]?.type !== 'heading' || blocks[0].level !== 1) throw new Error('Guide template must start with one H1 title');
const linkCount = [...markdown.matchAll(/\[[^\]]+\]\([^)]+\)/g)].length;
const expectedLinkDestinations = new Set(
  [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => absoluteLink(match[1])),
);
expectedLinkDestinations.add('https://host.safemsngr.com/widget/booking/8IOq6stkuqzk1H2VKRcS');
expectedLinkDestinations.add('mailto:hello@priceservicesgroup.com');

const pageObjects = [];
let currentPage = 0;
const doc = new PDFDocument({
  autoFirstPage: false,
  bufferPages: true,
  compress: true,
  size: [PAGE.width, PAGE.height],
  margins: { top: BODY_TOP, bottom: 34, left: MARGIN, right: MARGIN },
  info: {
    Title: `Medicare at 65: A practical ${facts.coverageYear} guide`,
    Author: 'Learn Medicare — Price Services Group, LLC',
    Subject: `Medicare education for ${facts.coverageYear}; content version ${facts.contentVersion}`,
    Creator: 'Learn Medicare guide renderer using PDFKit',
    CreationDate: new Date(`${facts.design.pdfExportedOn}T12:00:00Z`),
  },
});
doc.registerFont('OpenSans', FONT_REGULAR);
doc.registerFont('OpenSansBold', FONT_BOLD);

function drawHeader() {
  doc.save();
  doc.rect(0, 0, PAGE.width, 78).fill(PURPLE);
  doc.rect(MARGIN, 76, PAGE.width - MARGIN * 2, 2).fill(TEAL);
  doc.font('OpenSansBold').fontSize(10.5).fillColor('#ffffff')
    .text('THE TURNING 65', MARGIN, 18, { width: 175, characterSpacing: 0.5, lineBreak: false });
  doc.font('OpenSansBold').fontSize(24).fillColor(TEAL)
    .text('GUIDE', MARGIN, 31, { width: 175, lineBreak: false });
  const rightX = 190;
  const rightWidth = PAGE.width - MARGIN - rightX;
  doc.font('OpenSansBold').fontSize(7.2).fillColor('#eafffc')
    .text('CALL KAYLA PRICE  ·  866-648-1578', rightX, 16, { width: rightWidth, align: 'right', lineBreak: false });
  doc.text('BOOK CONSULTATION', rightX, 29, { width: rightWidth, align: 'right', lineBreak: false,
    link: 'https://host.safemsngr.com/widget/booking/8IOq6stkuqzk1H2VKRcS', underline: true });
  doc.text('HELLO@PRICESERVICESGROUP.COM', rightX, 42, { width: rightWidth, align: 'right', lineBreak: false,
    link: 'mailto:hello@priceservicesgroup.com', underline: true });
  doc.restore();
}

function addPage() {
  doc.addPage({ size: [PAGE.width, PAGE.height], margins: { top: BODY_TOP, bottom: 34, left: MARGIN, right: MARGIN } });
  currentPage += 1;
  drawHeader();
  doc.y = BODY_TOP;
}

function ensureSpace(height) {
  if (doc.y + height > BODY_BOTTOM) addPage();
}

function drawInline(parts, { size = 11.5, lineGap = 2, color = INK, x = MARGIN, width = BODY_WIDTH, marker = null } = {}) {
  const tokens = [];
  if (marker) tokens.push({ word: `${marker} `, font: 'OpenSansBold', color: PURPLE_DARK });
  for (const part of parts) {
    if (part.type === 'link') {
      for (const word of part.text.match(/\S+/g) ?? []) tokens.push({ word, font: 'OpenSans', color: LINK, url: part.url, underline: true });
    } else {
      for (const run of part.runs) {
        for (const word of run.text.match(/\S+/g) ?? []) tokens.push({
          word,
          font: run.options?.font ?? 'OpenSans',
          color: run.options?.color ?? color,
        });
      }
    }
  }
  for (let index = tokens.length - 1; index > 0; index -= 1) {
    if (/^[,.;:!?]+$/.test(tokens[index].word)) {
      tokens[index - 1].word += tokens[index].word;
      tokens.splice(index, 1);
    }
  }

  const lineHeight = size + lineGap + 2;
  const lines = [[]];
  let lineWidth = 0;
  const spaceWidth = doc.font('OpenSans').fontSize(size).widthOfString(' ');
  for (const token of tokens) {
    const tokenWidth = doc.font(token.font).fontSize(size).widthOfString(token.word);
    const gap = lines.at(-1).length ? spaceWidth : 0;
    if (lines.at(-1).length && lineWidth + gap + tokenWidth > width) {
      lines.push([]);
      lineWidth = 0;
    }
    const actualGap = lines.at(-1).length ? spaceWidth : 0;
    lines.at(-1).push({ ...token, width: tokenWidth, gap: actualGap });
    lineWidth += actualGap + tokenWidth;
  }
  const renderedLines = lines.filter((line) => line.length);
  const blockHeight = renderedLines.length * lineHeight;
  ensureSpace(blockHeight + 2);
  const startY = doc.y;
  renderedLines.forEach((line, lineIndex) => {
    let cursorX = x;
    const cursorY = startY + lineIndex * lineHeight;
    for (const token of line) {
      cursorX += token.gap;
      doc.font(token.font).fontSize(size).fillColor(token.color)
        .text(token.word, cursorX, cursorY, { lineBreak: false });
      if (token.url) {
        doc.link(cursorX, cursorY - 1, token.width, lineHeight, token.url);
        doc.save().moveTo(cursorX, cursorY + size + 1).lineTo(cursorX + token.width, cursorY + size + 1)
          .lineWidth(0.45).stroke(token.color).restore();
      }
      cursorX += token.width;
    }
  });
  doc.y = startY + blockHeight + 4;
}

function drawParagraph(text, options = {}) {
  drawInline(inlineParts(text), options);
}

function minimumFollowingHeight(block, headingText) {
  if (!block) return 0;
  if (block.type === 'paragraph') return 2 * (11.5 + 2 + 2) + 4;
  if (block.type === 'list') {
    if (/^official sources$/i.test(plainInline(headingText))) {
      return block.items.reduce((total, item) => total +
        doc.heightOfString(plainInline(item.text), {
          width: BODY_WIDTH - 4,
          font: 'OpenSans',
          fontSize: 10.5,
          lineGap: 1,
        }) + 8, 2);
    }
    return 2 * (11.5 + 2 + 2) + 4;
  }
  if (block.type === 'table') return 36;
  if (block.type === 'heading') {
    const size = block.level === 1 ? 18 : block.level === 2 ? 13 : 11.5;
    return size + 14;
  }
  return 0;
}

function drawHeading(block, nextBlock) {
  const title = plainInline(block.text);
  const size = block.level === 1 ? 18 : block.level === 2 ? 13 : 11.5;
  const color = block.level === 1 ? NAVY : block.level === 2 ? PURPLE_DARK : NAVY;
  const font = 'OpenSansBold';
  const height = doc.heightOfString(title, { width: BODY_WIDTH, font, fontSize: size, lineGap: 2 });
  // This section starts a long enrollment explanation. Keep the heading with
  // its first two lines instead of relying on content-specific blank lines.
  const keepWithNext = title === 'Enrollment through current employment'
    ? minimumFollowingHeight(nextBlock, block.text)
    : /^official sources$/i.test(title)
      ? minimumFollowingHeight(nextBlock, block.text)
      : 0;
  ensureSpace(height + 18 + keepWithNext);
  if (block.level === 1) {
    doc.font(font).fontSize(size).fillColor(color).text(title, MARGIN, doc.y, { width: BODY_WIDTH, lineGap: 2 });
    doc.y += 6;
  } else {
    doc.y += block.level === 2 ? 7 : 4;
    doc.font(font).fontSize(size).fillColor(color).text(title, MARGIN, doc.y, { width: BODY_WIDTH, lineGap: 2 });
    doc.y += block.level === 2 ? 5 : 3;
  }
}

function drawTable(rows) {
  const columnCount = rows[0].length;
  const widths = columnCount === 2
    ? [BODY_WIDTH * 0.75, BODY_WIDTH * 0.25]
    : [BODY_WIDTH * 0.62, BODY_WIDTH * 0.19, BODY_WIDTH * 0.19];
  const xPositions = widths.map((_, index) => MARGIN + widths.slice(0, index).reduce((sum, width) => sum + width, 0));
  const tableFont = 9.3;
  const cellPadding = 5;
  const drawRow = (cells, header = false) => {
    const cellHeights = cells.map((cell, index) => doc.heightOfString(cell, {
      width: widths[index] - cellPadding * 2,
      font: header ? 'OpenSansBold' : 'OpenSans',
      fontSize: tableFont,
      lineGap: 1,
    }));
    const rowHeight = Math.max(18, Math.max(...cellHeights) + cellPadding * 2);
    if (!header && doc.y + rowHeight > BODY_BOTTOM) {
      addPage();
      drawRow(rows[0], true);
    }
    const y = doc.y;
    if (header) doc.rect(MARGIN, y, BODY_WIDTH, rowHeight).fill(PALE);
    for (let index = 0; index < cells.length; index += 1) {
      doc.font(header ? 'OpenSansBold' : 'OpenSans').fontSize(tableFont).fillColor(header ? NAVY : INK)
        .text(cells[index], xPositions[index] + cellPadding, y + cellPadding, { width: widths[index] - cellPadding * 2, lineGap: 1 });
    }
    doc.moveTo(MARGIN, y + rowHeight).lineTo(MARGIN + BODY_WIDTH, y + rowHeight).lineWidth(0.45).stroke(RULE);
    doc.y = y + rowHeight;
  };
  ensureSpace(34);
  drawRow(rows[0], true);
  for (const row of rows.slice(1)) drawRow(row);
  doc.y += 8;
}

function drawList(items, { size = 11.5, lineGap = 2 } = {}) {
  for (const item of items) {
    drawInline(inlineParts(item.text), { x: MARGIN + 4, width: BODY_WIDTH - 4, size, lineGap, marker: item.marker });
  }
  doc.y += 2;
}

function drawCoverPortrait() {
  const portraitSize = 72;
  const x = (PAGE.width - portraitSize) / 2;
  const y = doc.y + 3;
  ensureSpace(portraitSize + 18);
  doc.save();
  doc.roundedRect(x - 4, y - 4, portraitSize + 8, portraitSize + 8, 8).lineWidth(1.3).stroke(TEAL);
  doc.image(PORTRAIT, x, y, { fit: [portraitSize, portraitSize], align: 'center', valign: 'center' });
  doc.restore();
  doc.y = y + portraitSize + 8;
  const logoWidth = 88;
  doc.image(LOGO, (PAGE.width - logoWidth) / 2, doc.y, { fit: [logoWidth, 46], align: 'center', valign: 'center' });
  doc.y += 49;
}

// Cover has the portrait and logo; the body and all tables remain one column.
addPage();
let coverPortraitAdded = false;
let compactSourceList = false;
for (const [index, block] of blocks.entries()) {
  if (block.type === 'heading') {
    drawHeading(block, blocks[index + 1]);
    compactSourceList = /^official sources$/i.test(plainInline(block.text));
    continue;
  }
  if (block.type === 'table') {
    drawTable(block.rows);
    continue;
  }
  if (block.type === 'list') {
    drawList(block.items, compactSourceList ? { size: 10.5, lineGap: 1 } : {});
    compactSourceList = false;
    continue;
  }
  if (block.type === 'paragraph') {
    const isCoverMetadata = index === 1 && /\*\*Coverage year:\*\*/.test(block.text);
    if (isCoverMetadata) {
      const lines = block.text.split(/\s+(?=\*\*Publisher:)/);
      for (const line of lines) drawParagraph(line, { size: 8.8, color: PURPLE_DARK, lineGap: 2 });
      drawCoverPortrait();
      coverPortraitAdded = true;
      continue;
    }
    drawParagraph(block.text, { size: 11.5, lineGap: 2 });
  }
}
if (!coverPortraitAdded) throw new Error('The printable guide cover did not include the expected portrait and logo');

const range = doc.bufferedPageRange();
const pageCount = range.count;
for (let pageIndex = range.start; pageIndex < range.start + pageCount; pageIndex += 1) {
  doc.switchToPage(pageIndex);
  const number = pageIndex - range.start + 1;
  const previousBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.save();
  doc.font('OpenSans').fontSize(7).fillColor('#596579')
    .text('Learn Medicare  ·  Price Services Group, LLC', MARGIN, PAGE.height - 22, { width: BODY_WIDTH - 35, lineBreak: false });
  doc.text(String(number), PAGE.width - MARGIN - 25, PAGE.height - 22, { width: 25, align: 'right', lineBreak: false });
  doc.restore();
  doc.page.margins.bottom = previousBottomMargin;
}

const chunks = [];
doc.on('data', (chunk) => chunks.push(chunk));
const completed = new Promise((resolve, reject) => {
  doc.on('end', resolve);
  doc.on('error', reject);
});
doc.end();
await completed;
const pdf = Buffer.concat(chunks);
if (!pdf.subarray(0, 8).toString('ascii').startsWith('%PDF-')) throw new Error('Generated guide is not a PDF');
const sha256 = createHash('sha256').update(pdf).digest('hex');
const outputs = [
  path.join(root, 'public/docs/T65-Medicare-Guide.pdf'),
  path.join(root, `public/docs/T65-Medicare-Guide-${facts.coverageYear}.pdf`),
];
for (const output of outputs) await writeFile(output, pdf);

const parsedPdf = await pdfjs.getDocument({ data: new Uint8Array(pdf) }).promise;
if (parsedPdf.numPages !== pageCount) throw new Error(`PDF page count mismatch: renderer=${pageCount}, parser=${parsedPdf.numPages}`);
const linkDestinations = new Set();
let pdfLinkAnnotationCount = 0;
for (let pageNumber = 1; pageNumber <= parsedPdf.numPages; pageNumber += 1) {
  const page = await parsedPdf.getPage(pageNumber);
  for (const annotation of await page.getAnnotations()) {
    if (annotation.url) {
      linkDestinations.add(annotation.url);
      pdfLinkAnnotationCount += 1;
    }
  }
}
for (const destination of expectedLinkDestinations) {
  if (!linkDestinations.has(destination)) throw new Error(`PDF is missing clickable source/link annotation: ${destination}`);
}
facts.pdfPageCount = pageCount;
facts.design.pdfPageCount = pageCount;
facts.design.exportedPdfSha256 = sha256;
facts.design.pdfLinkAnnotationCount = pdfLinkAnnotationCount;
facts.design.uniquePdfLinkDestinations = linkDestinations.size;
facts.design.pdfFontsEmbedded = true;
facts.design.embeddedFontFamilies = ['Open Sans'];
await writeFile(factsPath, `${JSON.stringify(facts, null, 2)}\n`);

const manifest = {
  contentVersion: facts.contentVersion,
  coverageYear: facts.coverageYear,
  exportedOn: facts.design.pdfExportedOn,
  generator: 'PDFKit with embedded Open Sans fonts',
  source: 'docs/guide-delivery/medicare-at-65-guide.template.md + src/data/medicare-guide-facts.json',
  pageCount,
  sourceMarkdownLinkCount: linkCount,
  pdfLinkAnnotationCount,
  uniquePdfLinkDestinations: linkDestinations.size,
  embeddedFontFamilies: ['Open Sans'],
  sha256,
  outputs: outputs.map((output) => path.relative(root, output)),
};
await writeFile(path.join(root, 'docs/guide-delivery/pdf-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest));
