import test from 'node:test';
import assert from 'node:assert/strict';
import { addFindingApproval, addFindingComment, canReviewFinding, canViewReview, setFindingAssignment } from '../lib/team-review.mjs';

const admin = { id: 'owner', displayName: 'Owner', role: 'admin' };
const reviewer = { id: 'reviewer1', displayName: 'Reviewer One', role: 'reviewer' };
const reviewerTwo = { id: 'reviewer2', displayName: 'Reviewer Two', role: 'reviewer' };
const finding = { id: 'quantity', title: 'Net quantity', evidence: [{ documentId: 'art-1', role: 'artwork', name: 'label.pdf', location: 'Page 1 · line 4', quote: 'Net wt. 750 g' }] };
const review = () => ({ id: 'review-1', findings: [finding], team: { createdBy: 'owner', assignments: {}, comments: [], approvals: [], assignmentHistory: [] } });

test('admins assign a finding to configured reviewers and reviewers gain scoped access', () => {
  const record = review();
  assert.equal(canViewReview(record, reviewer), false);
  assert.equal(setFindingAssignment(record, finding.id, [reviewer.id], admin, [reviewer, reviewerTwo]), true);
  assert.equal(canViewReview(record, reviewer), true);
  assert.equal(canViewReview(record, reviewerTwo), false);
  assert.equal(canReviewFinding(record, finding.id, reviewer), true);
  assert.equal(canReviewFinding(record, finding.id, reviewerTwo), false);
  assert.throws(() => setFindingAssignment(record, finding.id, ['unknown'], admin, [reviewer]), /configured reviewer accounts/);
});

test('comments persist an exact evidence anchor and the author identity', () => {
  const record = review();
  const comment = addFindingComment(record, finding, reviewer, { evidenceIndex: '0', comment: 'Check this value against the signed source.' }, '2026-10-19T00:00:00.000Z');
  assert.equal(comment.authorId, reviewer.id);
  assert.equal(comment.authorName, reviewer.displayName);
  assert.equal(comment.evidence.quote, 'Net wt. 750 g');
  assert.equal(comment.evidence.documentId, 'art-1');
  assert.equal(record.team.comments.length, 1);
  assert.throws(() => addFindingComment(record, finding, reviewer, { evidenceIndex: '4', comment: 'Invalid evidence reference.' }), /Choose evidence/);
});

test('each reviewer sign-off stays separate and later sign-offs retain their history', () => {
  const record = review();
  const first = addFindingApproval(record, finding, reviewer, { outcome: 'approved', note: 'Matches the confirmed value.' }, 'hash-v1', '2026-10-19T00:00:00.000Z');
  const second = addFindingApproval(record, finding, reviewerTwo, { outcome: 'needs_changes', note: 'The printed quantity still needs correction.' }, 'hash-v1', '2026-10-19T00:01:00.000Z');
  const refreshed = addFindingApproval(record, finding, reviewer, { outcome: 'abstain', note: 'I need the artwork owner to confirm this panel.' }, 'hash-v2', '2026-10-19T00:02:00.000Z');
  assert.equal(first.reviewerId, reviewer.id);
  assert.equal(second.reviewerId, reviewerTwo.id);
  assert.equal(refreshed.reviewerId, reviewer.id);
  assert.equal(record.team.approvals.length, 3);
  assert.deepEqual([...new Set(record.team.approvals.map(item => item.reviewerId))], [reviewer.id, reviewerTwo.id]);
  assert.throws(() => addFindingApproval(record, finding, reviewer, { outcome: 'approved', note: '' }, 'hash'), /sign-off note/);
});
