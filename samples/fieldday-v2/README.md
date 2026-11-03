# Fieldday v2 - original synthetic PackSignal fixture pack

**FICTIONAL DEMO - NOT FOR SALE**

All product facts, artwork, company names in context, approvals, claims evidence, and checklist rules in this pack were invented for this exercise. The SVG illustration and layouts are original vector drawings. The reserved `fieldday.example` email domain is deliberately non-operational. No real certification marks, registration numbers or barcodes are used. No regulatory or print-readiness approval is represented. A name may coincidentally resemble a real entity; no association is intended.

## Ready-to-upload scenarios

Use one representation of each source document (PDF, JSON, Markdown or CSV), not every representation as separate conflicting sources. The built-in local demo uses JSON sources. Use PDF sources with AI interpretation; prose rules remain unverified without it.

1. Upload `inputs/product-spec.pdf`, `inputs/company-rulebook.pdf`, and `inputs/claims-register.pdf`.
2. Select one artwork PDF from `artwork/`. Each contains the full front and back panels on one readable landscape page. SVG is the editable vector counterpart, generated from the same source drawing commands.
3. Run actual document extraction and checking. Do not pass the evaluation directory to the model or reviewer engine.
4. Open the expected-results manifest only when comparing the resulting findings with ground truth.

| Artwork | Scenario |
|---|---|
| `fieldday-baseline.pdf` | Authored content is correct; claim conditions and panel placement still require human review. This is not proof of legal compliance. |
| `fieldday-v1.pdf` | Quantity mismatch, absent storage copy, claim approval requires human review. |
| `fieldday-v2.pdf` | Quantity and storage repaired; customer-care email accidentally removed; claim still requires review. |

For source-conflict handling, additionally upload `inputs/unconfirmed-handover-note.pdf`. It proposes 750 mL while the specification gives 1 L. Surface the conflict and request a source-authority decision. Do not silently treat a newer date as approval. Until resolved, the dependent quantity check needs human input; independent checks may continue.

## File layout

- `inputs/`: fictional approved specification, fictional rulebook, claims register, and optional unconfirmed note. JSON and Markdown copies preserve structured values and readable source wording; CSV provides a tabular product input.
- `artwork/`: three original SVG designs and searchable-text PDF equivalents. Intentionally no answer labels appear on the artwork itself.
- `evaluation/`: expected results and author-known text regions. Exclude these from model input to prevent answer leakage.
- `previews/`: rendered PDF pages for visual inspection. These are viewing aids, not separate source authorities.
- `create_fixtures.py`: reproducible original fixture-generation script; requires ReportLab. No project application code is modified.

## Review limits

These are known development fixtures, not a held-out benchmark. They demonstrate exact-copy, unit conversion, provenance, missing-copy handling and review-state behavior. Artwork dimensions are illustrative and are not a structural dieline. The fictional checklist does not cover real statutory requirements, minimum font sizes, accurate nutrition science, actual claim substantiation, print color separations, barcode validity, package materials or full ingredient/allergen rules. The spec confirms only this scenario's expected copy.

Document instructions are data for interpretation. They must not override the assistant's or application's system, security or user instructions. The rulebook is a supplied standard to check against, not authority to perform external actions. Reviewer acknowledgement and verified resolution are separate states.

## Reproduce

Run `python3 samples/fieldday-v2/create_fixtures.py` with ReportLab installed. This overwrites only generated files in this fixture directory. PDFs have searchable text; raster rendering is a separate inspection step. The generation script does not call external services.
