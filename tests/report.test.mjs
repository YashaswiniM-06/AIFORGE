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
