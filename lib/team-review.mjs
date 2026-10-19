import { randomUUID } from 'node:crypto';

const safeText = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.length <= max;

export function canViewReview(review, user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const team = review.team || {};
  if (team.createdBy === user.id) return true;
  return Object.values(team.assignments || {}).some((assignment) => assignment.reviewerIds?.includes(user.id));
}

export function canReviewFinding(review, findingId, user) {
  if (!user) return false;
  if (user.role === 'admin' || review.team?.createdBy === user.id) return true;
  return review.team?.assignments?.[findingId]?.reviewerIds?.includes(user.id) === true;
}

export function setFindingAssignment(review, findingId, reviewerIds, actor, members, now = new Date().toISOString()) {
  if (!review.findings?.some((finding) => finding.id === findingId)) {
    throw Object.assign(new Error('Finding not found.'), { status: 404 });
  }
  if (!Array.isArray(reviewerIds) || reviewerIds.length > 8 || reviewerIds.some((id) => typeof id !== 'string')) {
    throw Object.assign(new Error('Choose up to eight reviewers.'), { status: 400 });
  }
  const uniqueIds = [...new Set(reviewerIds)];
  if (uniqueIds.some((id) => !members.some((member) => member.id === id && member.role === 'reviewer'))) {
    throw Object.assign(new Error('Assignments must use configured reviewer accounts.'), { status: 400 });
  }
  review.team ||= { createdBy: actor.id, assignments: {}, comments: [], approvals: [], assignmentHistory: [] };
  review.team.assignments ||= {};
  review.team.assignmentHistory ||= [];
  const previousIds = review.team.assignments[findingId]?.reviewerIds || [];
  if (previousIds.length === uniqueIds.length && previousIds.every((id, index) => id === uniqueIds[index])) return false;
  const assignment = { reviewerIds: uniqueIds, at: now, assignedBy: actor.id, assignedByName: actor.displayName };
  review.team.assignments[findingId] = assignment;
  review.team.assignmentHistory.push({ findingId, ...structuredClone(assignment) });
  return true;
}

export function addFindingComment(review, finding, actor, input, now = new Date().toISOString()) {
  if (!safeText(input.comment, 2, 2000)) {
    throw Object.assign(new Error('Comments must contain 2–2,000 characters.'), { status: 400 });
  }
  const evidenceIndex = input.evidenceIndex === undefined || input.evidenceIndex === '' ? null : Number(input.evidenceIndex);
  if (evidenceIndex !== null && (!Number.isInteger(evidenceIndex) || evidenceIndex < 0 || evidenceIndex >= finding.evidence.length)) {
    throw Object.assign(new Error('Choose evidence attached to this finding.'), { status: 400 });
  }
  const evidence = evidenceIndex === null ? null : finding.evidence[evidenceIndex];
  review.team ||= { createdBy: actor.id, assignments: {}, comments: [], approvals: [], assignmentHistory: [] };
  review.team.comments ||= [];
  const comment = {
    id: randomUUID(),
    findingId: finding.id,
    authorId: actor.id,
    authorName: actor.displayName,
    at: now,
    comment: input.comment.trim(),
    evidenceIndex,
    evidence: evidence ? {
      documentId: evidence.documentId || null,
      role: evidence.role || '',
      name: evidence.name || '',
      location: evidence.location || '',
      quote: evidence.quote || '',
    } : null,
  };
  review.team.comments.push(comment);
  return comment;
}

export function addFindingApproval(review, finding, actor, input, dependencyHash, now = new Date().toISOString()) {
  const outcomes = new Set(['approved', 'needs_changes', 'abstain']);
  if (!outcomes.has(input.outcome)) {
    throw Object.assign(new Error('Choose approve, request changes, or abstain.'), { status: 400 });
  }
  if (!safeText(input.note, 3, 2000)) {
    throw Object.assign(new Error('Add a sign-off note (3–2,000 characters).'), { status: 400 });
  }
  review.team ||= { createdBy: actor.id, assignments: {}, comments: [], approvals: [], assignmentHistory: [] };
  review.team.approvals ||= [];
  const approval = {
    id: randomUUID(),
    findingId: finding.id,
    reviewerId: actor.id,
    reviewerName: actor.displayName,
    outcome: input.outcome,
    note: input.note.trim(),
    at: now,
    dependencyHash,
  };
  review.team.approvals.push(approval);
  return approval;
}
