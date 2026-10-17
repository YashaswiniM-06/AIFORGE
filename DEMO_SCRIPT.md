# PackSignal recording script

Target length: 4 minutes 30 seconds. Record the actual app with legible browser zoom. Prepare reviews before recording so parsing/network waits do not consume the presentation. Show that they came from real inputs. A saved AI result is acceptable if clearly labeled as previously computed; never present a mocked result as live AI.

## 0:00–0:25 · Problem

“Packaging mistakes begin before the checker runs: references can be draft, quantities can conflict, and AI can mistake unreadable text for missing text. PackSignal gives a reviewer an inspectable chain from source to decision.”

Open the dashboard. State the selected artwork-review challenge.

## 0:25–1:30 · Official organizer files

Open Dancing Fish. Show source PDF and spreadsheet inventory, source status, and an ingredient discrepancy. Open the proof: source cell, expected copy, observed artwork, and highlighted page region.

“The reference is Draft / In Review. We report a discrepancy, not an invented conclusion that the artwork is illegal. The nutrition sheet has multiple columns, and pack size alone does not tell us which serving basis is correct.”

Show Sources. Leave genuinely unresolved authority/basis decisions unresolved.

## 1:30–2:15 · Meaningful AI and uncertainty

If a real Gemini review succeeded, show its engine label and an AI-proposed observation/rule with exact supporting evidence. Explain that a proposal is checked for source support and requires review.

A real Gemini run has now completed on Fieldday V1 (gemini-3.8-flash, one outbound attempt). The live-run PDF is included in submission/example-reports. Describe any reopened result as a saved real run.

If recording local mode without a new live call, say: “The Gemini integration has completed a real Fieldday review; this particular view uses local extraction and comparisons.” Show the saved Gemini review separately and identify it accurately.

Show an Unable to verify finding: absence is not claimed merely because extraction missed text.

## 2:15–3:10 · Controlled case and decision

Open Fieldday V1. Clearly say it is original fictional material. Show 1000 mL expected and 750 mL observed. Show missing storage wording. After personally inspecting full artwork and extracted content, confirm coverage with a rationale.

Record “Request a change” on quantity. Explain: “Acknowledging a finding does not make it pass.” Claim approval stays under human review.

Show the review-stage stepper, then open the quantity finding. Say: “The source cell, supplied requirement, and exact artwork region stay connected. The spotlight centers the box for inspection; the artwork itself is unchanged.” Show the millimeter cursor, layer toggles, and SHA-256 recheck. State that the reference is a comparison aid, not an approved replacement.

If time allows, switch to the 3D fold context. Drag the approximate cuboid and select a finding pin. Explain that faces come from reviewer-drawn zones; crease/cut geometry is not automatically inferred. Return to **Artwork map** and say: “This is check coverage, not AI confidence. Green, amber and red regions have a located supported check; uncolored artwork has not been claimed as checked.”

## 3:10–4:00 · The revision reveal

Open Fieldday V2 comparison. Quantity and storage now match, but the customer-care email has disappeared. Show the new failure and its source requirement.

Show the side-by-side artwork version view and synchronized scrolling before the status-change table.

“We rerun every supported check. Fixing the reported issue is not enough if the revision introduces another mistake.”

Panel placement confirmation must be performed again for revised artwork; do not carry it forward as proof.

## 4:00–4:30 · Close

Export the PDF or open the JSON audit record. End with:

“PackSignal does not issue a universal compliance score. It makes each supported check and each unresolved decision inspectable, so a person can decide what happens before print.”

If time permits, select the fictional Language + barcode / QR signals sample. Show that Spanish and French text are only flagged for translation review, and code detection reports type and approximate location without displaying payload or claiming scan quality. Select an optional market preset only as a starter checklist, and state that it does not provide legal compliance.

For a bilingual exact-copy demonstration, upload a separate source JSON containing a genuinely approved `translation_pairs` map with the artwork and its product specification. Show the paired source phrases beside the artwork evidence. If no reviewer-approved pair is available, demonstrate language detection only; do not describe it as semantic parity.

## Campus: 10 minutes + 5 minutes questions

- 1 minute problem and scope
- 3 minutes organizer review and proof chain
- 2 minutes AI interpretation and uncertainty
- 2 minutes controlled revision case
- 1 minute architecture and data handling
- 1 minute limitations, validation evidence and next steps

## Before recording

- Use the final engine version consistently; create fresh reviews after engine changes.
- Confirm the actual API quota and model; no secret visible in Settings or terminal.
- Read the sources personally before checking coverage/authority/placement boxes.
- Keep source decisions honest; the organizer draft remains draft unless authority is established.
- Open the evidence details and full artwork large enough to read.
- Check the exported report is legible and matches the shown review.
- Show the **Verify export seal** action and, if time allows, download the signed JSON and run `node scripts/verify-report.mjs report.json`. Explain that the check proves integrity against the included key; signer identity requires a separately trusted fingerprint.
- Package source under 50 MB. The ZIP excludes `.env*` credentials and `.packproof/` history.
- The user records and submits the video; no upload has been performed automatically.
