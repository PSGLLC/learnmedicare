import { readFile, writeFile } from 'node:fs/promises';
import { renderMedicareGuideTemplate } from '../src/lib/medicareGuideFacts.mjs';

const factsPath = new URL('../src/data/medicare-guide-facts.json', import.meta.url);
const templatePath = new URL('../docs/guide-delivery/medicare-at-65-guide.template.md', import.meta.url);
const outputPath = new URL('../src/pages/medicare-at-65-guide.md', import.meta.url);

const facts = JSON.parse(await readFile(factsPath, 'utf8'));
const template = await readFile(templatePath, 'utf8');
await writeFile(outputPath, renderMedicareGuideTemplate(template, facts));
