import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHtmlReport } from '../lib/html-report.mjs';
import { sealReview, verifyPortableSealProof } from '../lib/audit-signature.mjs';

test('portable HTML contains findings, follow-up answers, and a verifiable signature proof', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'packproof-html-'));
  try {
    const review = {
      id: 'review-html',
      createdAt: '2026-10-17T00:00:00.000Z',
      finishedAt: '2026-10-17T00:00:10.000Z',
      name: 'Portable example',
      documents: [{ id: 'source-1', role: 'spec', name: 'spec.json', sha256: 'abc', pages: [] }],
      findings: [{ id: 'finding-1', title: 'Net quantity', status: 'issue', explanation: 'Values differ.', expected: '1000 mL', observed: '750 mL', evidence: [] }],
      followUps: [{ findingId: 'finding-1', question: 'Which value is expected?', answer: 'The supplied specification says 1000 mL.', evidenceUsed: ['spec.json'], at: '2026-10-17T00:00:12.000Z' }],
      audit: [],
      warnings: ['Gemini coverage note: Page 4 was not processed.'],
      decisions: {},
      counts: { issue: 1, review: 0, unable: 0, match: 0 },
      coverage: { limits: [] },
    };
    review.signature = await sealReview(review, directory);
    const html = await createHtmlReport(review, directory);
    const embedded = html.match(/<script type="application\/json" id="packproof-signature-proof">([\s\S]*?)<\/script>/);
    assert.ok(embedded);
    assert.match(html, /The supplied specification says 1000 mL/);
    assert.match(html, /Processing notes/);
    assert.match(html, /Page 4 was not processed/);
    assert.equal(verifyPortableSealProof(JSON.parse(embedded[1])).valid, true);
    const reportPath = join(directory, 'report.html');
    await writeFile(reportPath, html);
    const verifierPath = fileURLToPath(new URL('../scripts/verify-report.mjs', import.meta.url));
    const checked = spawnSync(process.execPath, [verifierPath, reportPath], { encoding: 'utf8' });
    assert.equal(checked.status, 0, checked.stderr || checked.stdout);
    assert.match(checked.stdout, /VALID · Ed25519/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('portable HTML report preserves source revision values, checklist changes, and reviewer rechecks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'packproof-source-report-'));
  try {
    const html = await createHtmlReport({
      name: 'Source update',
      market: 'Example market',
      documents: [],
      findings: [],
      counts: {},
      coverage: { limits: [] },
      audit: [],
      revision: {
        kind: 'sources',
        sourceDocuments: [{ role: 'spec', name: 'spec-v2.json', beforeName: 'spec-v1.json', afterName: 'spec-v2.json', change: 'updated' }],
        changedFacts: [{ label: 'Net quantity', before: [{ value: '750 mL' }], after: [{ value: '1000 mL' }] }],
        changedRequirements: [{ name: 'company-checklist.json', change: 'updated', before: { text: 'Show 750 mL.' }, after: { text: 'Show 1000 mL.' } }],
        affectedFindings: [{ title: 'Net quantity', before: 'issue', after: 'match' }],
        decisionRechecks: [{ title: 'Net quantity', disposition: 'needs_changes', status: 'issue', currentStatus: 'match', note: 'Review current source.' }],
        changes: [],
      },
    }, directory);
    assert.match(html, /Source change impact/);
    assert.match(html, /750 mL/);
    assert.match(html, /1000 mL/);
    assert.match(html, /Show 750 mL\./);
    assert.match(html, /Earlier decisions to recheck/);
    assert.match(html, /Review current source\./);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('portable HTML report includes evidence comments and distinct reviewer sign-offs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'packproof-team-report-'));
  try {
    const html = await createHtmlReport({
      name: 'Team review', market: 'Example market', documents: [], findings: [{ id: 'f1', title: 'Net quantity', status: 'review', evidence: [] }],
      counts: {}, coverage: { limits: [] }, audit: [],
      team: {
        createdBy: 'owner', assignments: { f1: { reviewerIds: ['reviewer1'], assignedByName: 'Owner', at: '2026-10-19T00:00:00.000Z' } },
        comments: [{ findingId: 'f1', authorId: 'reviewer1', authorName: 'Reviewer One', at: '2026-10-19T00:01:00.000Z', comment: 'Check the exact quote.', evidence: { role: 'artwork', name: 'label.pdf', location: 'Page 1', quote: 'Net wt. 750 g' } }],
        approvals: [
          { findingId: 'f1', reviewerId: 'reviewer1', reviewerName: 'Reviewer One', outcome: 'approved', note: 'Evidence matches.', at: '2026-10-19T00:02:00.000Z' },
          { findingId: 'f1', reviewerId: 'reviewer2', reviewerName: 'Reviewer Two', outcome: 'needs_changes', note: 'Request correction.', at: '2026-10-19T00:03:00.000Z' },
        ],
      },
    }, directory);
    assert.match(html, /Team review record/);
    assert.match(html, /Net wt\. 750 g/);
    assert.match(html, /Reviewer One/);
    assert.match(html, /Reviewer Two/);
    assert.match(html, /Evidence matches\./);
    assert.match(html, /Request correction\./);
    assert.match(html, /do not authorize printing/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
