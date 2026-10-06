# PDF, Excel and CSV question import

In **My courses → Mock tests and quizzes → Create/Edit mock test**, choose **Import PDF, Excel or CSV**. The same importer is available for chapter quizzes. Download the header-only CSV/Excel template or choose an existing file. Set the CSV delimiter or English/Hindi + English OCR language, then **Read selected file**. Extraction is local to the browser; original files and page images are not uploaded to an OCR/AI service. Once added and saved, the converted question text and review details use the existing protected assessment API.

For tables, select one worksheet and map its columns. Preview the first five source rows, then **Review mapped questions**. PDF results go directly to review; extracted page text is also available for manual correction and detecting boundaries again. Questions appear in groups of five, with page/row references, confidence where available, and warnings. Previous/next retains edits. Missing keys and explanations remain blank. Correct them using the source and mark each question reviewed. Any later field edit clears that question's check.

**Add to assessment draft** opens an explicit confirmation: append retains existing questions; replace removes them from the unsaved form. Nothing is saved or published automatically. Incomplete questions can be added and saved as a draft within the normal text limits. Publishing is disabled until imported questions are complete and checked, and the backend independently validates the same review and content requirements. Review metadata survives draft save/reload and is available only to owners/admins. Active learner APIs still omit answers, explanations, snapshots and import metadata; existing attempts keep their original authored version.

## Supported formats and bounds

| Input | Supported layout | Limit |
| --- | --- | --- |
| `.csv` | UTF-8, optional BOM; comma, semicolon or tab; quoted commas/newlines/doubled quotes | 2 MiB, 500 nonempty data records + header, 24 columns, 4096 characters per source cell |
| `.xlsx` | Unencrypted OOXML; text/number cells, inline/shared strings; one selected worksheet | 10 MiB; 1–5 sheets; populated rows within rows 1–501; 500 data rows + header; 24 populated columns; 4096 characters per cell |
| `.pdf` | Numbered questions and labelled options; inline answers/explanations or a separate numbered answer key | 10 MiB, 20 pages, 500,000 extracted characters |
| Scanned PDF | Same question layout, recognized by local Tesseract in English or Hindi + English | At most 6 OCR pages; rendering at most about 2.5 million pixels, maximum side 1800, scale ≤2 |

All imports preserve at most **40 questions**; exceeding the limit rejects the pending import rather than truncating it. Append also checks the assessment's combined 40-question limit. Normal assessment fields remain 1200 question characters, 400 per option, 2000 explanation, 80 topic, 2–6 distinct options and a 1–180 minute mock timer. Oversized extracted fields require correction before they can be marked reviewed or saved.

The table template columns are `question, option_a, option_b, option_c, option_d, option_e, option_f, correct_answer, explanation, topic`. Question and options A/B must be mapped; C–F and topic are optional. Keys accept A–F, 1–6 or unique exact option text. Map answer/explanation columns when supplied; the importer does not generate them. Fully blank table records are ignored. Partially supplied mapped records remain visible for correction.

A simple PDF layout is:

```text
1. Author-supplied question text
A. Author-supplied option
B. Author-supplied option
Answer: B
Explanation: Author-supplied explanation
```

`(A)` and `A)` labels, Hindi क/ख/ग/घ/ङ/च, Devanagari question digits, `उत्तर:` and `व्याख्या:` are supported. A separate **Answer key** section can use `1.B 2.A`. Conflicting keys, repeated question numbers or ambiguous option labels do not select an answer. Continuations across pages retain page references. Multi-column reading order, headers/footers, numerical option labels, handwriting, equations and diagrams need manual correction. Images are not imported as quiz attachments; describe an essential diagram fully in text or remove the question. OCR confidence is a recognition signal, not an accuracy guarantee. Every OCR question requires human review even when confidence is high; confidence below 75 adds a warning.

Legacy `.xls`, encrypted PDFs/Excel, macro workbooks, selected-sheet formulas, merged cells, external worksheet references and boolean/error/date cell types are unsupported. Export unlocked plain values as `.xlsx` or UTF-8 CSV. Corrupt/oversized files report an actionable error. No macro, formula, document script or external document action is executed.

## Resource handling and cancellation

One extraction job runs at a time per browser app module. The UI stops extraction after four minutes. PDF load/page/text/operator/render phases have 20-second waits; OCR initialization and each recognition have 60-second waits; workbook expansion has 15 seconds; preparing an OCR image has five seconds. A PDF page is limited to 5000 text objects and 100,000 operators. PDF image decoding is capped at 16 million pixels. Workbook ZIP expansion is capped at 128 entries/16 MiB actual decompressed bytes and 2 MiB per needed XML part; XML complexity is capped before DOM parsing. Unsafe archive paths, duplicate entries/cells/rows and populated cells beyond the header width are rejected.

Cancellation, route/editor unmount and a detected expired session abort the operation, terminate owned workers and discard late results. The owned OCR supervisor contains Tesseract's child worker so cancellation can terminate it during asynchronous initialization as well as recognition. PDF loading/rendering is destroyed/cancelled; workbook workers terminate. Completed document results are not retained by the serialization queue. Cancelling pending review retains the assessment's existing questions. Save a draft to persist changes before leaving; local pending review is not autosaved.

## Dependencies, licenses and deployment payload

Pinned registry packages: `pdfjs-dist@6.4.299` (Apache-2.0), `tesseract.js@7.0.0` with lockfile-pinned `tesseract.js-core@7.0.0` (Apache-2.0), `fflate@0.8.3` (MIT), `@tesseract.js-data/eng@1.0.0` and `hin@1.0.0`. Language package registry metadata declares MIT; the upstream `naptha/tessdata` models are Apache-2.0. The app retains the upstream model license, engine/library licenses, package metadata and provenance notice. Dependencies were installed with scripts disabled. Existing audit findings in the Tailwind 3 build dependency tree were present before this increment; no new importer-library finding was identified. No unrelated forced dependency upgrade was applied.

`predev`/`prebuild` run `scripts/prepare-import-assets.mjs` to generate ignored `public/import-assets/` from installed pinned packages. Deployment needs Node **22.13+**; `.node-version` remains 22.22.2. Build/install settings and hosting credentials do not change. All PDF font/CMap/WASM and OCR worker/core/model requests target this app's own origin. No CDN fallback is configured. OCR has a cold download and CPU/memory cost, especially on phones; use CSV/Excel for the most predictable structured input.

Generated import support assets are approximately **50.3 MiB**: about 46.9 MiB OCR (all six compatible core variants, embedded/separate WASM files and two models) plus 3.4 MiB PDF font/CMap/WASM data. A browser loads the chosen OCR core, not all variants. English and Hindi compressed models are 2,952,873 and 1,389,692 bytes respectively; a selected LSTM core script is about 3.9 MB and the OCR worker is 111 KB. PDF parsing and its 1.26 MB worker, the 33 KB import UI and the 16 KB OCR supervisor are lazy/worker chunks. The main app bundle remains about 488 KB raw. These are artifact sizes, not measured compressed network transfers or device performance guarantees. The largest generated asset is under 5 MB.

Primary implementation references: [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html), [Tesseract API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md), [local assets](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md), [language-model provenance/license](https://github.com/naptha/tessdata), [fflate streaming ZIP](https://github.com/101arrowz/fflate).

## Verification

`npm run lint`, `npm test`, `npm run build` and `npm run check:cloudflare` are publication gates. `node tests/questionImport.test.js` reports twelve focused cases covering CSV quoting/Unicode/mapping/caps, PDF continuation/key ambiguity, missing content, archive validation and expansion bounds. The backend's full isolated MongoDB/HTTP suite passes 134 tests, including draft review persistence, malformed metadata, ownership, publish checks, immutable scoring and owner-only import metadata.

For actual file and authenticated UI verification, run `MOCK_TEST_BACKEND_DIR=/path/to/backend python3 tests/question_import_browser.py` with disposable loopback MongoDB on 27018 and the installed Chrome/Playwright/FFmpeg. It uses synthetic CSV/XLSX/digital/scanned PDF fixtures, real PDF.js/Tesseract English and Hindi models, real cookie login/API/Mongo persistence, five-question review navigation/editing, draft/reload/publish, student scoring, append/replace confirmation, malformed/encrypted/resource-cap rejection, worker cancellation/retry, route/session cleanup and both mobile themes. External hosts are blocked. The fixture database and browser/API processes are removed afterward. Existing mock-test and chapter-quiz browser suites are run as regression checks.

Git publication, static-asset readiness and a public backend health response are distinct from hosted authenticated acceptance. No real course questions/students, prices, enrollment, visibility, provider configuration, DNS or hosting credentials are changed by this feature. Accuracy on a particular instructor's complex PDF still requires reviewing that source; no sample from the user has been supplied.
