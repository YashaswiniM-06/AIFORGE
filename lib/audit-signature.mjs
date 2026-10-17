import { createHash, generateKeyPairSync, sign, verify } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const keyPromises = new Map();

const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const digest = value => createHash('sha256').update(canonical(value)).digest('hex');

function signedPayload(review) {
  return {
    schema: 'packproof-review-seal/v1',
    review: { id: review.id, createdAt: review.createdAt, finishedAt: review.finishedAt, name: review.name },
    sources: (review.documents || []).map(document => ({
      id: document.id,
      role: document.role,
      name: document.name,
      sha256: document.sha256,
    })),
    options: review.options || {},
    findings: (review.findings || []).map(finding => ({
      id: finding.id,
      status: finding.status,
      expected: finding.expected,
      observed: finding.observed,
      evidence: (finding.evidence || []).map(evidence => ({
        documentId: evidence.documentId,
        quote: evidence.quote,
        page: evidence.page || null,
        box: evidence.box || null,
      })),
    })),
    decisions: review.decisions || {},
    followUps: review.followUps || [],
    revision: review.revision || null,
    auditDigest: digest((review.audit || []).map(entry => ({ at: entry.at, action: entry.action, detail: entry.detail, options: entry.options || null }))),
  };
}

async function signingKeys(storage) {
  if (keyPromises.has(storage)) return keyPromises.get(storage);
  const pending = readOrCreateSigningKeys(storage).catch(error => {
    keyPromises.delete(storage);
    throw error;
  });
  keyPromises.set(storage, pending);
  return pending;
}

async function readOrCreateSigningKeys(storage) {
  const keyDirectory = join(storage, 'keys');
  const privatePath = join(keyDirectory, 'review-seal-private.pem');
  const publicPath = join(keyDirectory, 'review-seal-public.pem');
  await mkdir(keyDirectory, { recursive: true, mode: 0o700 });
  if (!existsSync(privatePath) || !existsSync(publicPath)) {
    const pair = generateKeyPairSync('ed25519');
    await writeFile(privatePath, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    await writeFile(publicPath, pair.publicKey.export({ type: 'spki', format: 'pem' }), { mode: 0o644 });
  }
  return { privateKey: await readFile(privatePath, 'utf8'), publicKey: await readFile(publicPath, 'utf8') };
}

export async function sealReview(review, storage) {
  const keys = await signingKeys(storage);
  const payload = signedPayload(review);
  const payloadHash = digest(payload);
  const publicKeyId = createHash('sha256').update(keys.publicKey).digest('hex').slice(0, 16);
  return {
    algorithm: 'Ed25519',
    schema: payload.schema,
    payloadHash,
    publicKeyId,
    publicKey: keys.publicKey,
    signature: sign(null, Buffer.from(canonical(payload)), keys.privateKey).toString('base64'),
    sealedAt: new Date().toISOString(),
  };
}

export function reviewSealProof(review) {
  const payload = signedPayload(review);
  return { canonicalPayload: canonical(payload), payloadHash: digest(payload) };
}

export function verifyPortableSealProof(proof) {
  try {
    if (!proof?.publicKey || !proof?.signature || proof.algorithm !== 'Ed25519') {
      return { valid: false, reason: 'The portable signature proof is incomplete.' };
    }
    const keyId = createHash('sha256').update(proof.publicKey).digest('hex').slice(0, 16);
    const payloadHash = createHash('sha256').update(proof.canonicalPayload).digest('hex');
    const valid = keyId === proof.publicKeyId
      && payloadHash === proof.payloadHash
      && verify(null, Buffer.from(proof.canonicalPayload), proof.publicKey, Buffer.from(proof.signature, 'base64'));
    return {
      valid,
      reason: valid ? 'The Ed25519 signature matches the included canonical payload.' : 'The payload, key fingerprint, or signature does not match.',
      publicKeyId: keyId,
      payloadHash,
    };
  } catch {
    return { valid: false, reason: 'The portable signature proof is malformed.' };
  }
}

export async function verifyReviewSeal(review, storage) {
  const seal = review.signature;
  if (!seal?.signature || seal.schema !== 'packproof-review-seal/v1') {
    return { valid: false, reason: 'No current signed seal is attached to this review.' };
  }
  const keys = await signingKeys(storage);
  const proof = { ...reviewSealProof(review), ...seal };
  const portable = verifyPortableSealProof(proof);
  const valid = seal.publicKey === keys.publicKey && portable.valid;
  return {
    valid,
    reason: valid ? 'The signed payload matches the current source hashes, findings, decisions and audit digest.' : 'The review changed after its last seal or the signature is invalid.',
    algorithm: seal.algorithm,
    payloadHash: seal.payloadHash,
    publicKeyId: seal.publicKeyId,
    sealedAt: seal.sealedAt,
  };
}
