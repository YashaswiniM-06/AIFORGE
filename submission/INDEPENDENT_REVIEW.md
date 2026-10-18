# Independent PackSignal review worksheet

**Status: not yet completed.** This worksheet only becomes independent validation after a reviewer who did not build PackSignal completes it using unfamiliar artwork and reference files.

## Handoff message

> Could you spend about 30 minutes doing a blind exploratory review of PackSignal using three packaging samples you have not seen in the app? Please choose one with a concrete mismatch, one that appears consistent on selected checks, and one with conflicting or incomplete source material. Before opening PackSignal, note the checks you can support and the exact artwork/source locations. Then create a review for each package, compare the app's results with your notes, and complete this worksheet. Please include anything PackSignal missed, any unsupported alert, evidence you could verify, and any ambiguous item it correctly left for human review. This is a small qualitative review, not a legal-compliance assessment or an accuracy study. Public sample files are preferred; do not share confidential customer artwork.

The reviewer can use the [PackSignal deployment](https://packsignal.onrender.com/) or a local copy. Ask them to record which they used and whether an AI-assisted result was live or saved.

## Reviewer setup

- Reviewer name or role:
- Relevant packaging, prepress, labeling, or quality-review experience:
- Date and PackSignal version/commit:
- Review mode: local / live AI-assisted / saved AI result
- AI model shown by the app, if applicable:

Choose at least three packaging sets the reviewer has not seen in PackSignal: one expected to contain a concrete mismatch, one expected to be consistent on the selected checks, and one with a source conflict or incomplete evidence. Use the artwork and its actual specification or supplied rule. Do not show the reviewer PackSignal's findings or any expected-result notes before their independent inspection. Do not use Dancing Fish or Fieldday as the only evidence; both are project demonstration samples.

## Blind inspection, before opening PackSignal

For each package, have the reviewer write down the checks they can support from the supplied files. Record the exact artwork text/page and the exact source value/page, sheet, or cell. Let them mark an item as **issue**, **matches supplied source**, **human review**, or **unable to verify**. Their judgment is the comparison record, not a legal-compliance determination.

| Package ID | Check / requirement | Reviewer result | Artwork evidence and location | Source evidence and location | Uncertainty or missing material |
|---|---|---|---|---|---|
| A |  |  |  |  |  |
| A |  |  |  |  |  |
| B |  |  |  |  |  |
| B |  |  |  |  |  |
| C |  |  |  |  |  |
| C |  |  |  |  |  |

## PackSignal run and comparison

After the blind notes are complete, create a new review for each package and keep the source roles accurate. Inspect PackSignal's result and evidence before comparing it with the reviewer notes. Record a mismatch as a false alarm, missed issue, appropriate human-review question, or appropriate unable-to-verify outcome. Add rows as needed.

| Package ID | Check | Reviewer result | PackSignal result | Was evidence traceable and accurate? | Difference / follow-up |
|---|---|---|---|---|---|
| A |  |  |  |  |  |
| B |  |  |  |  |  |
| C |  |  |  |  |  |

## Reviewer feedback

- Did any result look definite when the sources were actually ambiguous?
- Did any “matches reference” result rely on incomplete artwork or source coverage?
- Could you verify each selected finding without help from the builder?
- Which result would change your next action as a reviewer or designer?
- What was confusing, slow, or missing?
- Would you use this to focus a human review while retaining human release approval? Why or why not?

## Report the result honestly

Attach the reviewer's completed notes and identify the packages, app version, mode, and any known limitations. Report counts and examples descriptively; a few packages are too small and selected to support a general accuracy percentage. Do not call the review independent if the reviewer saw expected outcomes first, helped author the cases, or only inspected PackSignal-created examples whose answers were already known to the team.
