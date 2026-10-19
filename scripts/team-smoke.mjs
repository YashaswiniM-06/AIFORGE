import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const storage = await mkdtemp(join(tmpdir(), 'packsignal-team-smoke-'));
const accounts = [
  { username: 'owner', displayName: 'Workspace Owner', role: 'admin', password: 'test-owner-secret-2026' },
  { username: 'reviewer1', displayName: 'Reviewer One', role: 'reviewer', password: 'test-reviewer-one-2026' },
  { username: 'reviewer2', displayName: 'Reviewer Two', role: 'reviewer', password: 'test-reviewer-two-2026' },
];
let child;
let output = '';

async function freePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

const authorization = (account) => `Basic ${Buffer.from(`${account.username}:${account.password}`).toString('base64')}`;
async function request(base, account, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(account ? { authorization: authorization(account) } : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.method && options.method !== 'GET' ? { 'x-packproof-token': account.csrf } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { response, data };
}

async function ok(base, account, path, options = {}) {
  const result = await request(base, account, path, options);
  assert.ok(result.response.ok, result.data?.error || `${options.method || 'GET'} ${path} returned ${result.response.status}`);
  return result.data;
}

try {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      PACKPROOF_DATA_DIR: storage,
      PACKPROOF_TEAM_USERS: JSON.stringify(accounts),
      PACKPROOF_ACCESS_PASSWORD: 'legacy-password-must-not-work-with-team-users',
      PACKPROOF_REQUIRE_AUTH: 'true',
      GEMINI_API_KEY: '', GEMINI_API_KEY_2: '', GEMINI_API_KEY_3: '', GEMINI_API_KEY_4: '', GEMINI_API_KEY_5: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.setEncoding('utf8').on('data', chunk => { output += chunk; });
  child.stderr.setEncoding('utf8').on('data', chunk => { output += chunk; });

  let status, statusFailure = '';
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited early. ${output}`);
    try {
      const result = await request(base, accounts[0], '/api/status');
      if (result.response.ok) { status = result.data; break; }
      statusFailure = `HTTP ${result.response.status}: ${typeof result.data === 'string' ? result.data : JSON.stringify(result.data)}`;
    } catch (error) { statusFailure = error.message; }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(status, `Server did not become ready (${statusFailure}). ${output}`);
  assert.equal(status.team.enabled, true);
  assert.equal(status.team.currentUser.role, 'admin');
  assert.equal(status.team.members.length, 3);

  const anonymous = await request(base, null, '/api/status');
  assert.equal(anonymous.response.status, 401, 'Named-account mode rejects anonymous access.');
  const legacy = await request(base, { username: 'judge', password: 'legacy-password-must-not-work-with-team-users' }, '/api/status');
  assert.equal(legacy.response.status, 401, 'Team mode does not fall back to the shared demo password.');
  for (const account of accounts) account.csrf = (await ok(base, account, '/api/status')).csrf;

  const second = await ok(base, accounts[0], '/api/reviews', { method: 'POST', body: { sample: 'clean', mode: 'local' } });
  const created = await ok(base, accounts[0], '/api/reviews', { method: 'POST', body: { sample: 'fieldday', mode: 'local' } });
  const analysisDeadline = Date.now() + 120_000;
  let review;
  while (Date.now() < analysisDeadline) {
    review = await ok(base, accounts[0], `/api/reviews/${created.id}`);
    if (review.status === 'ready' || review.status === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(review?.status, 'ready', review?.error || 'The controlled sample did not finish.');
  assert.ok(review.findings.length > 1, 'The review should provide multiple findings for scoped-access checks.');
  assert.equal(review.team.createdBy, 'owner');

  let reviewerList = await ok(base, accounts[1], '/api/reviews');
  assert.equal(reviewerList.length, 0, 'Reviewers cannot list unassigned workspace reviews.');
  const inaccessible = await request(base, accounts[1], `/api/reviews/${created.id}`);
  assert.equal(inaccessible.response.status, 404, 'Unassigned reviews do not leak their content.');

  const sourceDocument = review.documents.find(document => document.role === 'spec');
  const target = review.findings.find(finding => finding.evidence.some(item => item.documentId === sourceDocument?.id));
  assert.ok(target, 'At least one finding must cite the supplied specification for team assignment.');
  await ok(base, accounts[0], `/api/reviews/${created.id}/assignments`, { method: 'POST', body: { findingId: target.id, reviewerIds: ['reviewer1', 'reviewer2'] } });
  reviewerList = await ok(base, accounts[1], '/api/reviews');
  assert.deepEqual(reviewerList.map(item => item.id), [created.id], 'Reviewers see only reviews with their finding assignment.');
  const reviewerBefore = await ok(base, accounts[1], `/api/reviews/${created.id}`);
  assert.equal(reviewerBefore.teamAccess.canAssign, false);
  assert.equal(reviewerBefore.teamAccess.canContribute, true);

  const forbiddenAssignment = await request(base, accounts[1], `/api/reviews/${created.id}/assignments`, { method: 'POST', body: { findingId: target.id, reviewerIds: [] } });
  assert.equal(forbiddenAssignment.response.status, 403, 'Only an admin can change assignments.');
  const unassignedFinding = review.findings.find(finding => finding.id !== target.id);
  const forbiddenComment = await request(base, accounts[1], `/api/reviews/${created.id}/comments`, { method: 'POST', body: { findingId: unassignedFinding.id, comment: 'I cannot comment here.', evidenceIndex: '' } });
  assert.equal(forbiddenComment.response.status, 403, 'A reviewer cannot comment on an unassigned finding.');

  const writes = await Promise.all([
    ok(base, accounts[1], `/api/reviews/${created.id}/comments`, { method: 'POST', body: { findingId: target.id, evidenceIndex: '0', comment: 'Reviewer One checked this quoted evidence.' } }),
    ok(base, accounts[2], `/api/reviews/${created.id}/comments`, { method: 'POST', body: { findingId: target.id, evidenceIndex: '0', comment: 'Reviewer Two independently checked this evidence.' } }),
    ok(base, accounts[1], `/api/reviews/${created.id}/approvals`, { method: 'POST', body: { findingId: target.id, outcome: 'approved', note: 'The evidence matches the cited requirement.' } }),
    ok(base, accounts[2], `/api/reviews/${created.id}/approvals`, { method: 'POST', body: { findingId: target.id, outcome: 'needs_changes', note: 'Please correct the displayed value.' } }),
  ]);
  assert.equal(writes.length, 4);
  const finalReview = await ok(base, accounts[0], `/api/reviews/${created.id}`);
  const savedComments = finalReview.team.comments.filter(comment => comment.findingId === target.id);
  const savedApprovals = finalReview.team.approvals.filter(approval => approval.findingId === target.id);
  assert.equal(savedComments.length, 2, 'Concurrent comments persist without overwriting one another.');
  assert.ok(savedComments.every(comment => comment.evidence?.quote), 'Each comment retains its evidence quote.');
  assert.deepEqual(new Set(savedApprovals.map(approval => approval.reviewerId)), new Set(['reviewer1', 'reviewer2']));
  assert.deepEqual(new Set(savedApprovals.map(approval => approval.outcome)), new Set(['approved', 'needs_changes']));
  assert.ok(finalReview.audit.some(event => event.action === 'finding_assigned' && event.actorId === 'owner'));
  assert.ok(finalReview.audit.filter(event => event.action === 'evidence_comment_added').length >= 2);

  const priorArtwork = review.files.find(file => file.role === 'artwork');
  const replacementFile = review.files.find(file => file.id === sourceDocument.id);
  const specV2 = JSON.parse(await readFile(join(root, 'samples/fieldday-v2/inputs/product-spec.json'), 'utf8'));
  specV2.product.net_quantity.value = 150;
  specV2.product.net_quantity.preferred_display = '150 mL';
  specV2.product.net_quantity.equivalent_display = '150 mL';
  const revised = await ok(base, accounts[0], '/api/reviews', { method: 'POST', body: {
    parentId: created.id, sourceRevision: true, mode: 'local', options: { marketPreset: 'none' },
    files: [{ replacesFileId: replacementFile.id, name: 'product-spec-v2.json', role: 'spec', base64: Buffer.from(JSON.stringify(specV2)).toString('base64') }],
  } });
  const revisionDeadline = Date.now() + 120_000;
  let revisedReview;
  while (Date.now() < revisionDeadline) {
    revisedReview = await ok(base, accounts[0], `/api/reviews/${revised.id}`);
    if (revisedReview.status === 'ready' || revisedReview.status === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(revisedReview?.status, 'ready', revisedReview?.error || 'The source revision did not finish.');
  assert.equal(revisedReview.files.find(file => file.role === 'artwork')?.sha256, priorArtwork?.sha256,
    'A source update must retain the exact original artwork bytes.');
  const carriedApprovals = revisedReview.team.approvals.filter(approval => approval.findingId === target.id);
  assert.equal(carriedApprovals.length, 2, 'Independent sign-offs remain in the revision history.');
  assert.ok(carriedApprovals.every(approval => approval.stale), 'Sign-offs tied to changed source evidence require rechecking.');
  const carriedComments = revisedReview.team.comments.filter(comment => comment.findingId === target.id);
  assert.equal(carriedComments.length, 2, 'Evidence discussion remains available on the revised review.');
  assert.ok(carriedComments.every(comment => comment.stale), 'Comments flag when their evidence dependency changed.');
  const assignedReviewerView = await ok(base, accounts[1], `/api/reviews/${revised.id}`);
  assert.ok(assignedReviewerView.teamAccess.canReviewFindingIds.includes(target.id), 'Assignments carry into revisions so reviewers can recheck them.');

  const outsider = await request(base, accounts[2], `/api/reviews/${second.id}`);
  assert.equal(outsider.response.status, 404, 'A teammate cannot access another review without an assignment.');
  console.log(JSON.stringify({ result: 'PASS', checks: ['named authentication', 'anonymous and legacy access rejected', 'review and finding scoped permissions', 'evidence anchored comments', 'separate reviewer sign-offs', 'concurrent writes retained', 'audited assignment and comments', 'source updates retain artwork and flag stale sign-offs/comments'] }, null, 2));
} catch (error) {
  console.error(`${error.stack || error}\n${output}`);
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) child.kill('SIGTERM');
  if (child) await new Promise(resolve => child.once('exit', resolve));
  await rm(storage, { recursive: true, force: true });
}
