# Annual Medicare at 65 guide maintenance

## One maintained content source

- `src/data/medicare-guide-facts.json` holds structured year-specific facts, official source URLs and publication dates, content version, and PDF export metadata.
- `docs/guide-delivery/medicare-at-65-guide.template.md` is the editorial template. It references structured facts rather than duplicating amounts.
- `npm run build` generates the online guide (`src/pages/medicare-at-65-guide.md`), review text, and PDFs through the prebuild scripts. `npm run guide:pdf` regenerates only the PDFs and manifest.
- `.node-version` pins Node 24.18.0 to match the isolated test workflow and Cloudflare Pages build. The macOS and Cloudflare preview PDFs can have different PDFKit-compressed bytes; compare extracted text, page count, link annotations, and layout rather than expecting identical platform hashes. The previous 2027.1 export had macOS SHA-256 `2ee0ebdc58f34b9b0de1b52ee0188b5089af9338f5483b831c4d31d2a3f656a1` and preview SHA-256 `1aae6c6dc2f12f09666120e5842f87366bc6b661cd2ef8fd3ed2bf0b982438e2`. For current PR head `1fc7b80`, the macOS manifest SHA-256 is `8741466282606223e8dc491bee901cbab69c910a1ff98dad0656025abbe017a0`; the preview response SHA-256 is `5b52084af9ec3f8e6fb7b23985e01af1e8dff97d4864fa3ec7ebe1771d605e7d`. The extracted text matches exactly across those artifacts.
- The current PDF URL is `/docs/T65-Medicare-Guide.pdf`; the online guide URL is `/medicare-at-65-guide/`. Keep both yearless. Keep dated archival editions separate and never overwrite historical PDFs.
- Cloudflare Pages `public/_headers` applies `Link: <https://learnmedicare.org/medicare-at-65-guide/>; rel="canonical"` only to the current yearless PDF. The static PDF remains accessible and is not automatically marked `noindex`; verify the response header on each preview before publication. The online HTML remains the preferred search version with its self-canonical.
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
- Layout version: `2027.2-layout-tool-2`; content version: `2027.2`; export date: `2026-11-23`.
- The 12-page repository-generated PDF embeds Open Sans, uses PSG logo/portrait assets, and includes verified source/contact link annotations. Exact counts and digest are in `docs/guide-delivery/pdf-manifest.json`.
- PDF pagination keeps every heading with its opening paragraph, first list item, or table header plus first row. Citation-list text is 10 pt with clear line spacing; body text remains 11.5 pt. Long tables and sections can continue onto later pages.
- PR #19 contains the review draft at the existing yearless asset path plus the dated 2027 edition. It remains unmerged, so the live PDF is unchanged. The historical 2026 PDF remains byte-for-byte unchanged.
- PR #19 preview validation on 2026-11-23: [online guide preview](https://aa5c8793.learnmedicare.pages.dev/medicare-at-65-guide/) returned 200 with the intended title, description, production self-canonical, one H1, five semantic tables, and accurate `WebPage`/`BreadcrumbList` metadata (`datePublished` 2026-11-22; `dateModified` 2026-11-23). The route is included in the built sitemap. The [PDF preview](https://aa5c8793.learnmedicare.pages.dev/docs/T65-Medicare-Guide.pdf) returned 200 as `application/pdf` and the actual response included `Link: <https://learnmedicare.org/medicare-at-65-guide/>; rel="canonical"`. Its preview-only `X-Robots-Tag: noindex` is supplied by the Pages preview platform; no `noindex` was added to the repository rules. Preview testing is not production deployment, search indexing, ranking, or AI-citation evidence.
- Rebuilding from the single template/facts source keeps the online guide and PDF content aligned. No automatic Canva synchronization is claimed. Email fulfillment remains inactive.
