# PackSignal judge demo

Target recording length: **4 minutes 15 seconds** (within the required 3–5 minutes). Keep the demo on one question: can a reviewer trace an artwork finding to its source, verify the evidence, and avoid a false sense of certainty?

Use the live app with readable browser zoom. Prepare the reviews before recording so parsing waits do not take up demo time. Show real app output; do not present a mockup or a saved AI result as a live request.

## Timed story

### 0:00–0:20 — The problem

Open the dashboard.

> “Before packaging goes to print, a reviewer has to reconcile the artwork with product facts and requirements. PackSignal makes that comparison traceable, and keeps uncertain results visible.”

State that this demo addresses the hackathon’s artwork-review problem.

### 0:20–1:05 — Real source uncertainty: Dancing Fish

Open the official organizer sample. Show the artwork and content spreadsheet in Sources, then open one concrete discrepancy and its source cell/artwork evidence. Point out that the spreadsheet is marked Draft / In Review and that its nutrition columns do not establish the serving basis.

> “The app reports what conflicts with the supplied material. It does not guess which draft fact is authoritative or call this a legal violation.”

Leave unresolved source questions unresolved. Do not click coverage or authority confirmations unless you have personally verified them.

### 1:05–1:35 — AI with evidence and limits

Show a genuine Gemini-assisted result with its supporting source quotation. Explain that AI proposes interpretations; exact comparisons use deterministic checks, and unsupported or ambiguous items stay with a reviewer.

Before recording, make a fresh live AI request if quota allows. If you show the previously completed Fieldday run instead, call it a **saved real AI result**, name the model shown in the app, and do not imply it was generated during the recording. If AI is unavailable, show the local result and state that clearly.

> “A missing extraction is not proof that text is absent. When coverage is uncertain, the app says ‘Unable to verify’ or asks for human review.”

### 1:35–2:35 — Follow one finding: fictional Fieldday V1

Open Fieldday V1 and clearly identify it as an original fictional case. Open the net-quantity finding. Show the supplied 1000 mL value beside the artwork’s 750 mL, along with the exact source and artwork evidence. Record “Request a change” with a short reason.

> “The reviewer decision is recorded separately; acknowledging a finding does not turn it into a pass.”

Stay in the 2D proof for legibility. Skip the full tab tour, the 3D turntable, and optional market/language/barcode tools in this short recording.

### 2:35–3:35 — Revision regression

Open Fieldday V2’s revision comparison. Show that the quantity was corrected but a different required statement disappeared.

> “Every supported check runs again on the revision. Fixing the reported mismatch can introduce a new one, so the reviewer sees both the correction and the regression.”

State that Fieldday is fictional and is used to make the revision behavior repeatable.

### 3:35–4:15 — Close with the trust boundary

Show the evidence-linked report or export action, then close with:

> “PackSignal does not issue universal compliance approval. It shows which supplied checks match, which conflict, and which still need a person—so a reviewer can make a better-informed decision before print.”

## Rehearsal and recording checklist

- Open the deployed app ahead of time, confirm the health page responds, and prepare the Dancing Fish and Fieldday reviews before recording. Confirm the AI model and quota with one fresh request if you intend to show live AI.
- Keep a saved, clearly labeled AI result available as a backup. Never describe a saved result as live.
- Use a fresh review after any engine change. Make sure the visible review matches the current source files and app version.
- Use a readable browser zoom, enlarge the evidence crop, and hide notifications and unrelated tabs.
- Rehearse the transition from Dancing Fish to Fieldday so the recording stays under five minutes. Do not spend time on every feature.
- If Render is slow or unavailable, start the local app with `npm start` and open `http://127.0.0.1:4173`. Run `npm run doctor` beforehand; use the prepared reviews and accurately label any saved AI result.
- Verify the exported report is legible and consistent with the review. The source package is built with `npm run package`; check it remains below the 50 MB submission limit.
- The demo recording and portal upload are separate deliverables. Record the actual app flow and upload the video to the hackathon submission yourself.

## Campus presentation: 10 minutes plus 5 minutes of questions

- 1 minute: problem and chosen challenge statement
- 3 minutes: Dancing Fish source ambiguity and evidence trail
- 2 minutes: AI’s role and how uncertainty is handled
- 2 minutes: Fieldday V1-to-V2 regression
- 1 minute: architecture and data flow
- 1 minute: evaluation limits, deployment fallback, and next step
