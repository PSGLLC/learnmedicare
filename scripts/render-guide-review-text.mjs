import { readFileSync, writeFileSync } from 'node:fs';

const input = 'src/pages/medicare-at-65-guide.md';
const output = 'docs/guide-delivery/2027-turning-65-guide.txt';
const markdown = readFileSync(input, 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
const sourceLines = markdown.split(/\r?\n/);
const lines = [];
let tableHeaders = [];
const normalize = value => value
  .replace(/\*\*/g, '')
  .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  .replace(/[–—]/g, '-').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/×/g, 'x')
  .replace(/•/g, '*');
for (let index = 0; index < sourceLines.length; index += 1) {
  const line = sourceLines[index].trim();
  if (!line) { lines.push(''); continue; }
  if (/^\|\s*-+/.test(line)) continue;
  if (line.startsWith('|')) {
    const cells = line.split('|').slice(1, -1).map(cell => normalize(cell.trim()));
    if (cells.length > 1) {
      const isHeader = sourceLines[index + 1]?.trim().startsWith('| ---');
      if (isHeader) {
        tableHeaders = cells;
      } else {
        lines.push('');
        lines.push(`* ${tableHeaders.length === 2 ? 'Item' : 'Income'}: ${cells[0]}`);
        cells.slice(1).forEach((cell, offset) => lines.push(`  ${tableHeaders[offset + 1] ?? `Column ${offset + 2}`}: ${cell}`));
      }
    }
    continue;
  }
  if (/^\|\s*:?-+/.test(line)) continue;
  const heading = line.match(/^(#{1,3})\s+(.*)$/);
  if (heading) {
    lines.push('');
    lines.push(heading[2].toUpperCase());
    lines.push('='.repeat(Math.min(heading[2].length, 68)));
    continue;
  }
  const normalized = line
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1 ($2)')
    .replace(/\*/g, '')
    .replace(/^[-+]\s+/, '* ');
  lines.push(...wrap(normalize(normalized), 68));
}
writeFileSync(output, `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`);

function wrap(value, width) {
  const words = value.split(/\s+/);
  const result = [];
  let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= width) line += ` ${word}`;
    else { result.push(line); line = word; }
  }
  if (line) result.push(line);
  return result;
}
