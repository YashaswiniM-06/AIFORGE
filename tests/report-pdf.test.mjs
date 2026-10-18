import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundledPython = join(process.env.HOME || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3');
const python = process.env.PACKPROOF_PYTHON || (existsSync(bundledPython) ? bundledPython : 'python3');

test('PDF keeps findings intact, removes duplicate evidence, and separates the seal footer', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'packsignal-report-pdf-'));
  try {
    const reviewPath = join(directory, 'review.json');
    const outputPath = join(directory, 'report.pdf');
    const findings = Array.from({ length: 12 }, (_, index) => {
      const number = String(index + 1).padStart(2, '0');
      const evidence = {
        documentId: 'spec-1',
        name: 'product-spec.json',
        location: `field ${number}`,
        quote: `unique-evidence-marker-${number}`,
      };
      return {
        id: `finding-${number}`,
        status: 'review',
        title: `Pagination finding ${number}`,
        expected: `expected-marker-${number}`,
        observed: `observed-marker-${number}`,
        explanation: `explanation-marker-${number} ${'Supporting detail for this packaging review. '.repeat(10)}`,
        evidence: index === 0 ? [evidence, structuredClone(evidence)] : [evidence],
      };
    });
    const review = {
      id: 'pdf-layout-regression',
      createdAt: '2026-10-18T00:00:00.000Z',
      name: 'PDF layout regression',
      market: 'Unspecified',
      engine: 'local',
      counts: { issue: 0, review: findings.length, unable: 0, match: 0 },
      findings,
      documents: [{ id: 'spec-1', role: 'spec', name: 'product-spec.json', sha256: 'a'.repeat(64) }],
      decisions: {},
      audit: [],
      warnings: [],
      coverage: { limits: [] },
      signature: { payloadHash: 'b'.repeat(64), algorithm: 'Ed25519', publicKeyId: 'test-key', sealedAt: '2026-10-18T00:00:00.000Z', signature: 'test', publicKey: 'test' },
    };
    await writeFile(reviewPath, JSON.stringify(review));

    const generated = spawnSync(python, [join(root, 'lib/extract.py')], {
      input: JSON.stringify({ action: 'report', review: reviewPath, output: outputPath }),
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(generated.status, 0, generated.stderr || generated.stdout);
    assert.ok((await readFile(outputPath)).byteLength > 1000);

    const inspected = spawnSync(python, ['-c', `
import json, sys
from pypdf import PdfReader
reader = PdfReader(sys.argv[1])
pages = [page.extract_text() or '' for page in reader.pages]
positions = {}
for page_number, page in enumerate(reader.pages):
    def visitor(text, cm, tm, font, size):
        if text.startswith('PackSignal - human release') or text.startswith('Seal bbbbbbbbbbbbbbbb'):
            positions[text.strip()] = tm[5]
    page.extract_text(visitor_text=visitor)
print(json.dumps({'pages': pages, 'positions': positions}))
`, outputPath], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(inspected.status, 0, inspected.stderr || inspected.stdout);
    const result = JSON.parse(inspected.stdout);
    assert.ok(result.pages.length > 1, 'The fixture should exercise page breaks.');
    for (let index = 0; index < findings.length; index += 1) {
      const number = String(index + 1).padStart(2, '0');
      const markers = [
        `Pagination finding ${number}`,
        `expected-marker-${number}`,
        `observed-marker-${number}`,
        `explanation-marker-${number}`,
        `unique-evidence-marker-${number}`,
      ];
      const containingPages = result.pages.filter(page => page.includes(markers[0]));
      assert.equal(containingPages.length, 1, `${markers[0]} should appear once.`);
      assert.ok(markers.every(marker => containingPages[0].includes(marker)), `${markers[0]} and its content should stay together.`);
    }
    assert.equal(result.pages.join('\n').split('unique-evidence-marker-01').length - 1, 1, 'Identical evidence for a finding should appear once.');
    assert.ok(result.pages.every(page => page.includes('PackSignal - human release decision required') && page.includes('Seal bbbbbbbbbbbbbbbb')), 'Each page should include both separated footer lines.');
    const footerY = Object.entries(result.positions);
    const brandY = footerY.find(([text]) => text.startsWith('PackSignal - human release'))?.[1];
    const sealY = footerY.find(([text]) => text.startsWith('Seal bbbbbbbbbbbbbbbb'))?.[1];
    assert.ok(Number.isFinite(brandY) && Number.isFinite(sealY) && Math.abs(brandY - sealY) >= 8, 'The footer and seal must occupy separate lines.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
