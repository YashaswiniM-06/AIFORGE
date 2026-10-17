import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { reviewSealProof, verifyPortableSealProof } from '../lib/audit-signature.mjs';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/verify-report.mjs <report.html|report.json>');
  process.exit(2);
}

try {
  const content = await readFile(path, 'utf8');
  let proof;
  if (extname(path).toLowerCase() === '.html') {
    const match = content.match(/<script type="application\/json" id="packproof-signature-proof">([\s\S]*?)<\/script>/);
    if (!match) throw new Error('This HTML report does not contain a portable signature proof.');
    proof = JSON.parse(match[1]);
  } else {
    const review = JSON.parse(content);
    if (!review.signature) throw new Error('This JSON report has no signature. Export it from PackSignal first.');
    proof = { ...reviewSealProof(review), ...review.signature };
  }

  const result = verifyPortableSealProof(proof);
  console.log(`${result.valid ? 'VALID' : 'INVALID'} · Ed25519 · key ${result.publicKeyId || proof.publicKeyId}`);
  console.log(result.reason);
  if (result.valid) {
    console.log(`Payload SHA-256: ${result.payloadHash}`);
    console.log('This verifies the included payload against the included key. Confirm the key fingerprint separately to trust signer identity.');
  } else {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
