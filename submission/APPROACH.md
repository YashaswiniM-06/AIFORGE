# PackSignal: an evidence-backed packaging release review

## Problem

Before printing packaging, reviewers reconcile artwork, product spreadsheets and company rules. The reference itself may be draft or contradictory. Extracting text alone does not establish which value is approved, whether the comparison uses the right serving basis, or whether a missing phrase is genuinely absent.

## Our approach

PackSignal compiles supplied information into an inspectable review:

**Source fact → supplied requirement → artwork evidence → check result → reviewer decision.**

The product centers on the artwork-checker theme. Its truth sheet resolves reference uncertainty as a prerequisite to checking artwork; it is not a second design-brief product.

1. Ingest artwork, specifications, rules and claims evidence with explicit roles.
2. Extract native text and spreadsheet cells with provenance; use optional multimodal AI where interpretation is useful.
3. Surface conflicting source values and ambiguous nutrition bases before dependent comparisons.
4. Execute supported comparisons and preserve unsupported checks as unverified.
5. Expose proof in a visual reviewer interface, with source quotations and page/cell locations.
6. Add optional visual coverage, code/location, language and market-review aids without turning them into unsupported compliance claims.
7. Record a human decision without laundering the machine status into a pass.
8. Compare a revised artwork against the same references and rerun every supported check.
9. Seal each exported snapshot with a local Ed25519 proof. HTML and JSON expose the canonical payload and public key for offline integrity checks; signer identity still depends on a separately trusted key fingerprint.

## Differentiation

- **Authority before comparison:** a newer or better-formatted document is not automatically an approved source.
- **Absence requires coverage:** failure to extract a statement is not proof it is missing.
- **Evidence is inspectable:** source hashes, quotations, page coordinates and spreadsheet cells accompany findings.
- **Bounded AI contract:** Gemini fact proposals are schema-limited to fields the checker supports, then checked again before use; a valid-looking quote cannot turn an unsupported field into a checklist result.
- **Revision safety:** fixing quantity can accidentally remove customer-care copy. Rerunning the whole checklist catches the regression.
- **Honest uncertainty:** AI-transcribed text, uncompiled rules and unsubstantiated claims are routed to a reviewer.
- **Portable traceability:** HTML and JSON exports include an inspectable signature proof and a verifier command; the PDF carries its signature and key fingerprint alongside the review evidence.
- **All-occurrence review:** each detected net-quantity declaration is checked, including repeats, so one correct occurrence cannot hide a conflicting declaration.
- **Context-sensitive copy checks:** negated and obsolete wording cannot pass as a match. Possible sibling-SKU copy is raised as a reviewer prompt rather than an automatic defect.
- **Product-family screening:** recognizable spreadsheet SKU tables are compared with the artwork for sibling variant, ingredient, allergen, quantity and barcode strings. Hits point to the exact source row and remain review prompts.
- **Cross-language copy control:** when the source provides required, approved phrase pairs, exact copy is checked for each language version. This catches supplied wording that is missing from one side without pretending to translate or assess meaning.
- **Claim review prompts:** common environmental claims ask for package-specific supporting evidence. These prompts do not establish claim truth or legal acceptability.
- **Actionable correction handoff:** the designer ticket carries source, observed text and artwork location, while avoiding invented point sizes or layer names.
- **Visual corroboration:** rendered-page transcription can be compared with native PDF text. A mismatch prompts crop inspection because OCR can miss text; it does not prove invisibility.
- **Evidence-bound decisions:** when source, artwork, rule, or mapped-panel dependencies change, prior confirmations are invalidated instead of silently reused.
- **Dieline-aware preview setup:** PDF/image inputs can provide positioned face-label hints and rendered long-line candidates. ASCII DXF also preserves supported line and lightweight-polyline coordinates, explicit cut/crease/glue layer names, and uniquely labelled closed panel regions. The reviewer maps artwork crops and confirms them before a carton, pouch, bottle-label, or sleeve context view appears. These package forms remain illustrative, not CAD solids; the established Dancing Fish and Fieldday artwork previews remain unchanged.

## Actual samples

The official Dancing Fish carton PDF and US product spreadsheet are loaded directly. The spreadsheet identifies itself as draft and notes reconstructed information. Nutrition values have multiple pack-size columns, making the serving basis a human decision. The organizer files provide evidence of ambiguity; we do not declare them legally noncompliant.

A separately labeled fictional Fieldday example supplies controlled baseline/V1/V2 artwork, company rules and source facts. The application performs real extraction and comparisons; it does not read its author-known expected-result manifest.

## Technology

Node 24 native HTTP server; HTML/CSS/JavaScript interface; Python PDFium for PDF text and rendering; OpenPyXL for spreadsheet cells; python-docx for document text; Pillow for images; ReportLab for exported reports. Optional Gemini through the official generateContent API with JSON-schema output. Exact comparisons handle quantities and numeric checks. No vector database or autonomous agent orchestration is necessary for this bounded review.

## Current completion boundary

The local application, sample loaders, upload workflow, evidence inspection, source decisions, revision comparison and reports are implemented. One live Gemini review of the fictional Fieldday V1 files completed using gemini-3.8-flash: 19 fact proposals, 12 rule proposals and 2 observations. AI interpretations still require source validation and reviewer confirmation. Future requests depend on the user's project quota. The prototype is not certified for broad regulatory or prepress checks, and no independent packaging expert has validated it. No accuracy percentage or customer outcome is claimed.

The completed UX adds an artwork check-coverage map, original-artwork visual comparison, synchronized revision viewer, guided organizer walkthrough, dark mode, workspace analytics and portable HTML export. Optional US, India and EU starter prompts link to official sources. They identify review topics and text cues only; legal applicability, typography, mandatory formatting and full country coverage remain human work. Market-cue pattern tests now exercise each preset. The separate translation-pair, SKU-table and sustainability tests are synthetic regression cases, not independent accuracy evidence.

## Local regression evaluation

The deterministic engine has a 21-case, hand-authored synthetic regression set. The latest run matched all 21 expected outcomes: 8/8 defect cases routed to issue, zero issue alarms among 6 clean cases, 3/3 ambiguous cases routed to review, 3/3 unreadable cases routed to unable, and 1/1 revision regression caught. Across the set, 14 comparisons completed and 3 could not be verified. These fixtures are known examples, not an independent benchmark or an accuracy estimate. `npm run evaluate` reports comparison completion and in-memory deterministic analysis time; this excludes upload, conversion, optional Gemini calls, and reviewer time.

`npm run smoke` separately starts an isolated local server, ingests the official organizer PDF and spreadsheet, completes a review, records a reviewer decision, generates portable HTML and PDF exports, and verifies the export seal. It makes no external AI request and writes to a temporary data directory. This validates the HTTP workflow and export path, not model accuracy or legal correctness.

## Project name

The project is presented as PackSignal to distinguish it from [Esko's existing Pack Proof product](https://www.esko.com/en/products/pack-proof). PackSignal is a working name; trademark and domain availability have not been cleared.
