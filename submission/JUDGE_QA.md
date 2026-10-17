# Likely judge questions

**Why is this more than OCR?**
OCR/text extraction is one input. PackSignal reconciles source authority, maps facts to supplied rules, distinguishes uncertainty, exposes evidence, records human decisions, and rechecks revisions.

**Why use AI?**
Prose specifications, rule interpretation and visual content are less structured than unit comparisons. Gemini proposes interpretations and observations; exact code handles checks it can perform reliably. Show a real successful call before claiming the AI portion was demonstrated.

**Can AI invent a requirement?**
The engine requires a supporting source quotation for AI rules/facts. Unsupported output is discarded. Rule interpretations still need reviewer confirmation; a matching quote alone does not establish correct interpretation.

**Can you guarantee compliance?**
No. The system evaluates supplied documents and implemented comparisons. Full legal applicability, print production and final approval need qualified review and broader validated coverage.

**Why are there so many human-review items in the organizer example?**
The supplied reference is draft and nutrition columns have an ambiguous basis. A trustworthy reviewer should expose that ambiguity instead of guessing and producing false certainty.

**How does it catch sibling-SKU copy contamination?**
When a spreadsheet has a clearly labeled product-family table, PackSignal checks recognizable sibling-row variants, ingredients, allergen wording, quantities and barcode digits against the artwork. It links a hit to the exact cell and artwork text. It stays a review prompt because shared copy and cross-promotion may be intentional.

**Does it prove an environmental claim is substantiated?**
No. It flags common wording and can surface a reference string from the supplied claims register. A reviewer must open and evaluate the actual supporting material for the exact claim, product and market. The reference string itself is not proof.

**Can it tell whether French and English warnings mean the same thing?**
It can compare exact, required phrase pairs that the source owner has supplied and approved. It can expose a missing phrase on one language side once source authority and artwork coverage are confirmed. It does not translate or decide semantic, safety or legal equivalence.

**Do the mapped panel zones define legal display panels?**
No. A reviewer draws rectangles over the supplied artwork. PackSignal uses those zones only for supported supplied checklist rules assigned to the selected face; it does not infer statutory display panels or determine legal placement.

**How does a designer know what to change?**
The copyable ticket carries the supplied wording, observed artwork text, page and approximate location. It does not invent an Illustrator layer, font size or legal replacement when the supplied source does not specify one.

**What stops an approval click from hiding an error?**
Machine status and human disposition are separate. Acknowledgment is recorded with a note; it does not mark the artwork corrected. Revisions must be re-extracted and rechecked.

**What happens if the model fails or quota runs out?**
PackSignal retries 429 and 503 responses within fixed per-request and per-session limits, then can fail over to another configured Gemini key. A failed key is cooled down. If the pool cannot complete the request, local checks remain available and the AI failure is shown. This is bounded failover, not unlimited quota or guaranteed availability.

Offline regression tests cover same-key retries, cooldown and the transport behavior used by a second credential. They do not simulate Google's quota system end to end. Keys in the same Google project may share project limits.

**How do you know a missing phrase is really absent?**
Initially we do not. It remains unverified until native extraction coverage is explicitly inspected. AI transcription alone cannot prove absence. Missing/hidden panels remain a limitation.

**What makes the evidence trustworthy?**
Original file hashes, exact source quotes, sheet/cell references, page images and native text coordinates make findings inspectable. They do not authenticate source authority or prove an invisible PDF text object was printed.

**Can the exported report be independently verified?**
HTML and JSON include a canonical signed payload, Ed25519 signature and public key. Run `node scripts/verify-report.mjs report.html` or use the JSON export. This proves the payload matches that key; trust the key fingerprint through a separate channel to identify the signer. The PDF prints its signature and fingerprint and should be paired with the matching HTML or JSON proof.

**What was independently evaluated?**
The supplied organizer files and author-known fictional examples demonstrate operation. They are not a held-out benchmark. Do not quote an accuracy percentage or claim expert validation without actual independent evaluation.

Do not claim competing products are old, brittle or inferior without independent, current evidence. Position PackSignal around its demonstrated workflow and evidence trail rather than unsupported comparisons.

The local HTTP smoke check additionally runs the supplied organizer PDF and spreadsheet through upload, extraction, review, a reviewer disposition, HTML/PDF export, and seal verification. The separate 21-case expected-outcome set checks deterministic routing on hand-authored examples. Neither establishes external accuracy or regulatory correctness.

**What is needed for production?**
Authenticated roles, durable multi-user storage, secure isolated parsing, audit integrity, retention controls, versioned domain rules, independent evaluation, monitoring and qualified regulatory review. The current local prototype deliberately has a narrower deployment boundary.
