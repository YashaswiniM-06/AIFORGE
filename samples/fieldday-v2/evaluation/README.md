# Evaluation-only material

Do not upload this directory as product evidence or give it to the model. It contains the expected answers and author-known text locations so we can score extraction and comparison separately. A model run must infer its findings from the files in `inputs/` and the chosen artwork only.

Counts: baseline 12 matches; V1 9 matches, 2 issues, 1 needs-human-review; V2 10 matches, 1 issue, 1 needs-human-review. The V1-to-V2 transition resolves R03 and R11, preserves R12 for review, and introduces R09 (missing customer-care email).

Coordinates are manually authored text bounding regions, not OCR output. Each page is 1200 x 860 with origin at top left; boxes are x, y, width, height. Convert top-left coordinates when comparing with PDF libraries that use a bottom-left origin. Boxes include approximate font ascent/descent and are intended as localization ground truth, not legal typography measurements.

The fixtures are developer-known examples. They are not an unseen benchmark and must not be represented as evidence of general accuracy. The manifest counts the 12 content rules with complete readable input. The application can additionally report source-authority, source-conflict and panel-placement review findings; before coverage confirmation omissions remain unverified.

## Deterministic engine regression set

`engine-cases.json` contains 21 hand-authored local regression cases. Run `npm run evaluate` from the project root to print observed outcomes, group metrics and deterministic analysis time. `npm test` also checks that the authored expected statuses remain unchanged.

The set covers 8 deliberate defects, 6 clean inputs, 3 ambiguous cases, 3 cases that cannot be verified and 1 revision regression. A clean-case issue count makes “flag everything” behavior visible. Processing time covers the in-memory deterministic `analyze` path only; it excludes upload, PDF conversion, model calls and reviewer time. Expected outcomes are authored alongside the cases, so a complete pass is a regression result, not independent accuracy, a confidence measure or production evidence. The application never loads this evaluation file during a review.
