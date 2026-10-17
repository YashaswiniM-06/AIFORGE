# PackSignal — the packaging compiler

A working local artwork-review application for **Esko AIForge 2026**, addressing **“Is this Packaging Artwork ready to launch?”**

PackSignal connects a supplied product fact, checklist requirement, artwork evidence, result, and reviewer decision. It compares documents; it does not certify legal compliance or authorize printing.

PackSignal is the working project name chosen to avoid confusion with [Esko's existing Pack Proof product](https://www.esko.com/en/products/pack-proof). This is a name-selection decision, not trademark or domain clearance.

The review workflow takes cues from professional prepress and artwork-management concepts in [Esko WebCenter](https://www.esko.com/en/products/webcenter); PackSignal is an independent hackathon prototype and is not an Esko product.

## Run

Requires Node.js 24+ and Python 3.10+.

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Create `.env.local` from `.env.example`; set `PACKPROOF_PYTHON` to your absolute `.venv/bin/python` path. On this Codex workstation the bundled Python is discovered automatically.

```sh
npm run doctor
npm start
```

Open **http://127.0.0.1:4173**. There are no npm runtime dependencies. The server deliberately listens only on the local computer. Keep the terminal running. If `npm start` says PackSignal is already listening, leave that server running and refresh the page instead of starting another copy.

## What works

- Upload one artwork and up to seven references, with explicit document roles.
- Read searchable PDFs with page coordinates; read XLSX cells, DOCX text/tables, CSV, JSON, TXT and Markdown.
- Render PDF/image artwork for visual inspection. Images and scans require optional AI transcription or manual review.
- Show a check-coverage map directly on the artwork: located matches are green, human-review findings amber, and issues red. Uncolored areas are not claimed as checked.
- Open a visual copy comparison for located discrepancies. It shows original artwork, observed evidence and supplied reference text without altering the artwork.
- Review in a three-column workbench with a four-stage source-to-audit stepper. The artwork viewer adds a live prepress HUD, PDF-calibrated cursor coordinates in millimeters, zoom, evidence/panel layers, and a browser-side SHA-256 recheck of the original file.
- Map Front, Back, Left, Right, Top, and Bottom rectangles on the supplied artwork. The optional draggable 3D fold context maps those reviewed regions to carton faces and places selectable finding pins. It is an approximate cuboid, not a CAD dieline fold simulation; cut/crease geometry, board stock, and glue structure are not inferred.
- Open a proof dialog that auto-centers and zooms to the located artwork region, dims the surrounding area, and draws an SVG trace from source evidence to the artwork box. The supplied reference remains a comparison aid and never edits the artwork.
- Uncorroborated native PDF text becomes a visibility question for a person; an OCR miss is never treated as proof of absence.
- Inspect every detected net-quantity occurrence. With multiple structured SKU sources and a resolved variant, sibling-variant wording is surfaced as a human-review prompt rather than an automatic defect.
- Scan clearly tabular product-family spreadsheets for another SKU's variant, allergen copy, ingredients, quantity, or barcode. Each hit links to its source cell and artwork evidence, and stays a human-review prompt because cross-promotion can be intentional.
- Review common environmental claim wording against a supplied claims register. A listed reference is evidence to inspect, not proof of substantiation, certification, legality, or truth.
- Compare reviewer-supplied required language pairs exactly when a JSON reference includes `translation_pairs`. Missing copy is an issue only after the source and complete-artwork coverage are confirmed; the check does not machine-translate or judge semantic equivalence.
- Compare revision artwork side by side, export a self-contained HTML review, and use a guided tour of the organizer sample.
- Screen extracted PDF text heights against a reviewer-selected threshold, run internal nutrition plausibility checks, and inspect allergen emphasis cues. These are review aids, not legal determinations.
- Draw panel zones over supplied artwork. PackSignal reports which supported checklist rules are assigned to a mapped face and compares located text geometry against those zones; the reviewer-drawn rectangles do not define legal panel boundaries.
- Ask a follow-up question scoped to one finding’s evidence, copy a designer change request, and seal each exported review snapshot with a local Ed25519 signature. HTML and JSON include a portable proof; the PDF prints the signature and key fingerprint. Verify HTML or JSON with `node scripts/verify-report.mjs <report.html|report.json>`.
- Add optional US, India and EU starter review prompts, multilingual-content signals, and local barcode/QR type-and-location detection. These are review aids, not legal or print-quality certification.
- Extract a source-linked truth sheet, flag conflicting values and draft references.
- Compare supported copy, net quantities with unit conversion, and nutrition values with basis checks.
- Retain uncompiled prose rules as unverified rather than hiding them.
- Show expected and observed values, source filenames/cells/pages and artwork regions.
- Confirm source authority, extraction coverage, panel placement, and ambiguous nutrition columns with a recorded rationale.
- Record reviewer dispositions without changing machine results.
- Rerun all checks for revised artwork and identify resolved/new/changed/not-rechecked findings.
- Export a PDF report or complete JSON record; retain local review history.
- Optional Gemini: interpret source prose, propose rule interpretations, read image text, and identify evidence-backed questions. AI quotations are checked against supplied text; AI interpretations and transcriptions require human confirmation.

## Included files

**Organizer case:** the official Dancing Fish carton and content spreadsheet are in `samples/organizer/`. The application loads and parses those actual files. Their provenance is recorded there. The spreadsheet is draft, contains reconstructed information, and has ambiguous nutrition columns. No organizer rulebook was found among the two linked sample downloads.

**Controlled fictional case:** `samples/fieldday-v2/` includes original front/back artwork, a product specification, 12 company rules, a claims register, and an optional conflicting handover note. Baseline, V1 and V2 demonstrate clean copy, omissions, source conflict and regression. JSON sources power the local built-in path. PDF source versions are available for AI-assisted interpretation. Evaluation answer files are never read by the application or sent to AI.

**Older starter files:** the original root `app.js`, `index.html`, `styles.css`, `assets/` and `data/` remain as legacy material. They are not served. The current application is in `public/` with `server.mjs` and `lib/`.

## API configuration

Local mode requires **no API spending**. AI-assisted mode is the default: PackSignal extracts sources and runs exact checks first, makes those findings available, then runs Gemini in the background if server-side credentials are configured. If Gemini is not configured or a request fails, the local review remains available with an explicit status. Settings is read-only and never accepts or returns credentials. Set `GEMINI_API_KEY` through `GEMINI_API_KEY_5` and `GEMINI_MODEL` in the ignored `.env.local` file, then restart the server. A review starts with one configured credential; after a bounded quota or temporary-provider failure, the coordinator can restart the AI review with another configured credential.

Gemini is the primary and only implemented LLM provider; Groq is not integrated. The initial configurable model is `gemini-3.8-flash`. Availability and free quota must be checked in the user's actual Google project. A real Gemini 3.8 Flash review of Fieldday V1 has completed in one outbound attempt; its PDF is included in the example reports. A newly configured key is not represented as verified access until its request succeeds.

The adapter retries only 429/503 responses and honors provider retry delays. Retries stay on the same credential; after a quota or temporary provider failure, that credential enters cooldown and the bounded coordinator can try another configured credential. Defaults are at most three attempts per request, 6 seconds between outbound attempts, and 20 outbound attempts per server session. Retries count toward that ceiling. A provider delay beyond the retry budget defers AI work. Local findings remain available with an explicit AI failure or deferral notice. Multiple credentials do not create unlimited quota or guarantee provider availability. See `submission/API_SETUP.md` for limits and recovery details.

## Data and boundaries

When running locally, records live in `.packproof/reviews/`. A hosted instance stores review files on its configured persistent disk. AI mode sends extracted text and up to 12 rendered pages to Google in batches of three; omitted or untranscribed pages remain unverified. No external model request is made in local-only mode. Use only fictional or otherwise permitted files in a hosted demo.

Upload limits: 8 files, 15 MB/file, 30 MB/review; PDFs up to 12 pages; spreadsheets up to 2,000 rows × 80 columns per sheet. Oversized Office archives are rejected. Macros and external spreadsheet links are not executed. Source documents are data, not instructions.

Only allowlisted public files and review API routes are served. The server checks host/origin and requires a per-session request token for mutations. The hosted demo adds one shared Basic Auth gate; it is not user accounts, role-based access, or tenant isolation. Keep hosted uploads limited to permitted demo material. See `submission/KNOWN_LIMITS.md` before using it beyond a controlled demonstration.

## Submission

- `submission/APPROACH.md`: problem, differentiation and implementation
- `submission/ARCHITECTURE.md`: architecture and flow diagram
- `DEMO_SCRIPT.md`: 3–5 minute recording and campus walkthrough
- `submission/JUDGE_QA.md`: likely questions and honest answers
- `ROADMAP.md`: final preparation and later production work

Run `npm run package` to create `submission/packsignal-source.zip`. It excludes credentials, review history, virtual environments and unrelated research. Record the actual running app with organizer files; do not substitute a mock AI run for a live one.

Run `npm test` for zero-dependency Node regression checks, including market-preset cues, exact bilingual copy pairs, sibling-SKU screening, sustainability review, panel-zone behavior and bounded Gemini failover. `npm run smoke` starts a separate local server with an isolated temporary data directory, reviews the official PDF/XLSX sample, records a reviewer decision, exports HTML/PDF, and verifies the report seal. It makes no external AI request and does not alter saved workspace reviews. `npm run evaluate` runs 21 hand-authored synthetic expected outcomes covering clean content, defects, ambiguity, extraction gaps and one revision regression. It reports detected defects, clean-case issue alarms, review/unable routing, comparison completion and deterministic analysis time. These are local regression checks, not an independent accuracy or production performance benchmark.

A prepared three-page brief is in `submission/PackSignal-Submission-Brief.pdf`; example reports are in `submission/example-reports/`. For custom source schemas, see `submission/INPUT_FORMATS.md`. Current local example reports contain no reviewer dispositions. The retained Gemini report is a historical integration example using an earlier fixture. Neither set represents external reviewer approval.
