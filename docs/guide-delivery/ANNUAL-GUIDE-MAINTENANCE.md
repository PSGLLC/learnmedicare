# Annual Medicare at 65 guide maintenance

## Canonical records and generated files

- `src/data/medicare-guide-facts.json` is the structured source for the guide's coverage year, enrollment year, announcement/effective dates, tax year, Part A/B/D amounts, IRMAA rows, official-source URLs/publication dates, and the current PDF edition.
- `docs/guide-delivery/medicare-at-65-guide.template.md` is the editorial template. It contains placeholders for the structured facts, not independent copies of amounts.
- `npm run build` first runs `scripts/render-medicare-guide.mjs`, which creates `src/pages/medicare-at-65-guide.md`, and `scripts/render-guide-review-text.mjs`, which creates `docs/guide-delivery/2027-turning-65-guide.txt`. Both outputs come from the same values. Generated outputs are committed so review diffs show exactly what visitors and the guide designer will receive.
- The stable online guide and current-PDF paths remain `/medicare-at-65-guide/` and `/docs/T65-Medicare-Guide.pdf`. Keep previous PDFs under dated paths such as `/docs/T65-Medicare-Guide-2026.pdf` and `/docs/T65-Medicare-Guide-2027.pdf`.

## Source monitoring and annual review

Use the existing [PSG Main annual Medicare cost source monitor](https://github.com/PSGLLC/PSG-Main-Website/actions/workflows/annual-medicare-cost-monitor.yml); do not create a second scheduled workflow in Learn Medicare. It checks CMS, Medicare.gov, and SSA on its existing schedule and records source outcomes. A successful check is evidence for review, not publication approval.

When that monitor reports a supported change:

1. Read the monitor's source report and compare each proposed amount, coverage year, publication date, and effective date with the official source itself. If a source is missing, inaccessible, or ambiguous, keep the last verified figure and note the source status; do not infer a future amount.
2. A human reviewer updates `medicare-guide-facts.json` only after verifying every applicable amount and source. Keep the announcement date distinct from the January 1 effective date, and keep the AEP enrollment year distinct from the coverage year.
3. Record the actual substantive content review in `reviewDate` and the content version. Preserve `datePublished`; do not advance `dateModified` for a monitor-only or verification-only check.
4. Run `npm run build` and the full isolated test workflow. Review both generated content files. The output warns when `pdfCoverageYear` differs from `coverageYear`; never describe an older PDF as the current year's guide.
5. Update the editable Canva design from the generated text and structured facts. Human action is required: review the complete copy, source links, claims, layout and accessibility in Canva; export the approved design to PDF; inspect each page and all links; then record the Canva design URL/ID, content version, PDF SHA-256 and actual export/review date in `medicare-guide-facts.json` and this release record. Canva does not automatically synchronize with the website or PDF.
6. Include the new dated PDF edition and the same approved PDF at the yearless current URL in the review PR. Keep the prior dated edition unchanged. A reviewer must approve content and PDF changes; no monitor job merges or deploys them.

## Failure and rollback behavior

The build renderer reads only the committed JSON and template. It does not fetch external pages or mutate facts. A failed/ambiguous monitor result therefore cannot overwrite Learn Medicare values. A malformed year, date, source URL, missing amount, or incomplete IRMAA table fails generation rather than publishing partial output.

If a draft update is wrong, restore the previous JSON, template/generated Markdown/text, and PDF files from the preceding commit. Keep both yearless URLs stable. Do not replace the current PDF until the replacement is supplied, reviewed, and its coverage year matches the online figures.

## Current design/export record

The selected Canva design, branded PDF export, and final visual review are pending the owner's choice of design reference. Until those steps are completed and reviewed, the current PDF/design must not be described as an approved branded edition, and FAQ email fulfillment remains inactive.
