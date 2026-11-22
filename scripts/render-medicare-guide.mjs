import { readFile, writeFile } from 'node:fs/promises';

const factsPath = new URL('../src/data/medicare-guide-facts.json', import.meta.url);
const templatePath = new URL('../docs/guide-delivery/medicare-at-65-guide.template.md', import.meta.url);
const outputPath = new URL('../src/pages/medicare-at-65-guide.md', import.meta.url);

const facts = JSON.parse(await readFile(factsPath, 'utf8'));
validateFacts(facts);
const template = await readFile(templatePath, 'utf8');
const pageCountText = ({ 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten' })[facts.pdfPageCount] ?? String(facts.pdfPageCount);
const money = (value) => {
  if (!Number.isFinite(value) || value < 0) throw new Error('Annual guide contains an invalid money value');
  return `$${value.toLocaleString('en-US', Number.isInteger(value)
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const date = (iso) => {
  const parsed = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(parsed);
};
const table = (year, heading, rows) => [
  `| ${year} ${heading} | Amount |`,
  '| --- | ---: |',
  ...rows.map(([label, value]) => `| ${label} | ${value} |`),
].join('\n');
const amounts = facts.amounts;
const individualRows = amounts.irmaa.individualAndJointRows.map((row) => `| ${row[0]} | ${row[1]} | ${row[2]} |`).join('\n');
const separateRows = amounts.irmaa.marriedFilingSeparatelyRows.map((row) => `| ${row[0]} | ${row[1]} | ${row[2]} |`).join('\n');
const sources = facts.sources;
const pdfMatchesCoverageYear = facts.pdfCoverageYear === facts.coverageYear;

const tokens = {
  coverageYear: String(facts.coverageYear),
  enrollmentYear: String(facts.enrollmentYear),
  reviewDate: facts.reviewDate,
  reviewDateDisplay: date(facts.reviewDate),
  announcementDateDisplay: date(facts.announcementDate),
  effectiveDateDisplay: date(facts.effectiveDate),
  irmaaTaxYear: String(facts.irmaaTaxYear),
  cmsPartABUrl: sources.cmsPartAAndB.url,
  cmsPartDParametersUrl: sources.cmsPartDParameters.url,
  cmsPartDBaseUrl: sources.cmsPartDBasePremium.url,
  cmsPartDPublicationDate: date(sources.cmsPartDParameters.publishedDate),
  partDBasePremiumPublicationDate: date(sources.cmsPartDBasePremium.publishedDate),
  medicarePartDUrl: sources.medicarePartD.url,
  ssaIrmaaUrl: sources.ssaIrmaa.url,
  partATable: table(facts.coverageYear, 'Part A item', [
    ['Inpatient hospital deductible (each benefit period)', money(amounts.partA.inpatientDeductible)],
    ['Hospital coinsurance, days 61–90', `${money(amounts.partA.hospitalCoinsuranceDays61To90)} per day`],
    ['Lifetime reserve days', `${money(amounts.partA.lifetimeReserveDay)} per day`],
    ['Skilled nursing facility coinsurance, days 21–100', `${money(amounts.partA.skilledNursingDays21To100)} per day`],
    ['Monthly premium with 30–39 Medicare-covered work quarters', money(amounts.partA.monthlyPremium30To39Quarters)],
    ['Monthly premium with fewer than 30 quarters', money(amounts.partA.monthlyPremiumUnder30Quarters)],
  ]),
  partBTable: table(facts.coverageYear, 'Part B item', [
    ['Standard monthly premium', money(amounts.partB.standardMonthlyPremium)],
    ['Annual deductible', money(amounts.partB.annualDeductible)],
  ]),
  partDTable: table(facts.coverageYear, 'Part D item', [
    ['Maximum standard deductible', money(amounts.partD.definedStandardDeductibleMaximum)],
    ['Annual out-of-pocket threshold for covered Part D drugs', money(amounts.partD.annualOutOfPocketThreshold)],
  ]),
  partDDeductible: money(amounts.partD.definedStandardDeductibleMaximum),
  partBStandardPremium: money(amounts.partB.standardMonthlyPremium),
  partDBasePremium: money(amounts.partD.nationalBaseBeneficiaryPremium),
  irmaaRows: individualRows,
  separateIrmaaRows: separateRows,
  pdfLinkText: pdfMatchesCoverageYear
    ? `Download the ${pageCountText}-page printable ${facts.coverageYear} guide (PDF)`
    : `Download the ${pageCountText}-page printable ${facts.pdfCoverageYear} guide (PDF)`,
  pdfEditionNotice: pdfMatchesCoverageYear
    ? 'The yearless PDF address serves the current edition; dated editions remain archived separately.'
    : `The yearless PDF currently contains the ${facts.pdfCoverageYear} edition, not the ${facts.coverageYear} guide. A matching branded PDF must be reviewed and exported before replacing it.`,
};

let rendered = template;
for (const [key, value] of Object.entries(tokens)) {
  rendered = rendered.replaceAll(`{{${key}}}`, String(value));
}
const unresolved = rendered.match(/\{\{[^}]+\}\}/g);
if (unresolved) throw new Error(`Unresolved annual guide template token(s): ${[...new Set(unresolved)].join(', ')}`);

await writeFile(outputPath, rendered);

function validateFacts(data) {
  for (const key of ['coverageYear', 'enrollmentYear', 'irmaaTaxYear', 'pdfCoverageYear']) {
    if (!Number.isInteger(data[key])) throw new Error(`Annual guide ${key} must be an integer year`);
  }
  if (!Number.isInteger(data.pdfPageCount) || data.pdfPageCount < 1) throw new Error('Annual guide PDF page count must be a positive integer');
  if (data.enrollmentYear + 1 !== data.coverageYear) throw new Error('The AEP year must precede the guide coverage year');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.reviewDate) || !/^\d{4}-\d{2}-\d{2}$/.test(data.effectiveDate)) throw new Error('Annual guide dates must be ISO calendar dates');
  if (!Number.isFinite(Date.parse(`${data.announcementDate}T00:00:00Z`))) throw new Error('CMS announcement date is invalid');
  for (const [name, source] of Object.entries(data.sources)) {
    if (!source.url?.startsWith('https://')) throw new Error(`Annual guide source ${name} must use HTTPS`);
    if (source.coverageYear != null && !Number.isInteger(source.coverageYear)) throw new Error(`Annual guide source ${name} has invalid coverage-year metadata`);
  }
  for (const amount of [
    data.amounts.partA.inpatientDeductible,
    data.amounts.partA.hospitalCoinsuranceDays61To90,
    data.amounts.partA.lifetimeReserveDay,
    data.amounts.partA.skilledNursingDays21To100,
    data.amounts.partA.monthlyPremium30To39Quarters,
    data.amounts.partA.monthlyPremiumUnder30Quarters,
    data.amounts.partB.standardMonthlyPremium,
    data.amounts.partB.annualDeductible,
    data.amounts.partD.definedStandardDeductibleMaximum,
    data.amounts.partD.annualOutOfPocketThreshold,
    data.amounts.partD.nationalBaseBeneficiaryPremium,
  ]) if (!Number.isFinite(amount) || amount < 0) throw new Error('Annual guide amount is invalid');
  if (data.amounts.irmaa.individualAndJointRows.length !== 6 || data.amounts.irmaa.marriedFilingSeparatelyRows.length !== 3) {
    throw new Error('Annual guide IRMAA rows are incomplete or ambiguous');
  }
}
