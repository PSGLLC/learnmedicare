# Annual Medicare at 65 guide maintenance

## One maintained content source

- `src/data/medicare-guide-facts.json` holds structured year-specific facts, official source URLs and publication dates, content version, and PDF export metadata.
- `docs/guide-delivery/medicare-at-65-guide.template.md` is the editorial template. It references structured facts rather than duplicating amounts.
- `npm run build` generates the online guide (`src/pages/medicare-at-65-guide.md`), review text, and PDFs through the prebuild scripts. `npm run guide:pdf` regenerates only the PDFs and manifest.
- The current PDF URL is `/docs/T65-Medicare-Guide.pdf`; the online guide URL is `/medicare-at-65-guide/`. Keep both yearless. Keep dated archival editions separate and never overwrite historical PDFs.
- The editable layout is the repository Markdown/facts source plus `scripts/render-medicare-guide-pdf.mjs` (PDFKit). This is **not a Canva-editable design**. Canva served only as the visual reference; the original Canva design is unchanged.

## Annual review and approval

1. Use the existing [PSG Main annual Medicare cost source monitor](https://github.com/PSGLLC/PSG-Main-Website/actions/workflows/annual-medicare-cost-monitor.yml). It checks CMS, Medicare.gov, and SSA; its results signal review and are not publication approval.
2. A human verifies each proposed amount, coverage year, publication date, and effective date directly against current official sources. If a source is unavailable or ambiguous, preserve the last verified facts and record the limitation. Never infer a future figure.
3. Update `medicare-guide-facts.json` and the content template only after evidence is confirmed. Distinguish announcement date, effective date, enrollment year, and coverage year. Preserve `datePublished`; update `reviewDate`/`dateModified` only after substantive review or revision, not a monitoring-only check.
4. Run `npm run build`, `npm run guide:pdf`, and the isolated full test workflow. Review source diffs and the manifest. The renderer records the SHA-256, page count, embedded fonts, link annotations, and unique destinations.
5. Inspect every PDF page at normal reading size and in print output. Check tables, page breaks, selectable text, embedded fonts, clickable source links, contact links, guide completeness, and consistency with the online page. Confirm the year shown in the PDF matches the approved online facts.
6. Prepare both the stable current PDF and dated annual archive from the same reviewed output. A human must approve the content and PDF in the PR. The monitor never merges or deploys. Merging the approved PR is the publication step.

## Failure and rollback

The local renderers consume committed JSON and template files; they do not fetch or interpret source websites. Failed/ambiguous monitoring cannot mutate Learn facts. Invalid years, dates, URLs, missing required amounts, or incomplete IRMAA rows fail validation instead of generating partial output.

To roll back a bad draft, restore the prior facts, template, generated Markdown/text, PDF files, and manifest from the preceding commit. Keep the yearless routes stable. Never replace the live PDF until the reviewed PR is approved and merged.

## Current 2027 review artifact

- Visual reference: `2026 T65 Guide (short)`; the original Canva design is preserved.
- Layout version: `2027.1-layout-tool-1`; content version: `2027.1`; export date: `2026-11-23`.
- The 10-page repository-generated PDF embeds Open Sans, uses PSG logo/portrait assets, and includes verified source/contact link annotations. Exact counts and digest are in `docs/guide-delivery/pdf-manifest.json`.
- PR #19 contains the review draft at the existing yearless asset path plus the dated 2027 edition. It remains unmerged, so the live PDF is unchanged. The historical 2026 PDF remains byte-for-byte unchanged.
- Rebuilding from the single template/facts source keeps the online guide and PDF content aligned. No automatic Canva synchronization is claimed. Email fulfillment remains inactive.
