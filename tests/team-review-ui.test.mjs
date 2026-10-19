import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { teamReviewView } from '../public/team-review.js';

const review = {
  team: {
    createdBy: 'owner',
    assignments: { finding: { reviewerIds: ['reviewer1'] } },
    comments: [{ findingId: 'finding', authorId: 'reviewer1', authorName: '<reviewer>', comment: '<unsafe>', at: '2026-10-19T00:00:00.000Z', evidence: { role: 'artwork', name: 'label.pdf', location: 'Page 1', quote: '<750 g>' } }],
    approvals: [{ findingId: 'finding', reviewerId: 'reviewer1', reviewerName: '<reviewer>', outcome: 'approved', note: 'Checked source.', at: '2026-10-19T00:00:00.000Z' }],
  },
  teamAccess: { canAssign: true },
};
const finding = { id: 'finding', title: 'Quantity', evidence: [{ role: 'artwork', name: 'label.pdf', location: 'Page 1', quote: '750 g' }] };
const appStatus = { team: { enabled: true, currentUser: { id: 'owner', displayName: 'Owner', role: 'admin' }, members: [{ id: 'reviewer1', displayName: 'Reviewer One', role: 'reviewer' }] } };

test('team review UI includes assignment, evidence comment, and independent sign-off controls', () => {
  const html = teamReviewView(review, finding, appStatus);
  assert.match(html, /data-team-form="assignments"/);
  assert.match(html, /data-team-form="comments"/);
  assert.match(html, /data-team-form="approvals"/);
  assert.match(html, /Reviewer One/);
  assert.match(html, /&lt;750 g&gt;/, 'Evidence quotes must be safely escaped before rendering.');
  assert.doesNotMatch(html, /<blockquote><750 g><\/blockquote>/);
  assert.match(html, /&lt;unsafe&gt;/);
  assert.match(html, /not legal or print-release approval/);
});

test('unconfigured shared-login workspaces clearly state that individual sign-off is disabled', () => {
  const html = teamReviewView(review, finding, { team: { enabled: false }, security: { hosted: true, authenticated: false } });
  assert.match(html, /Team review is currently off/);
  assert.match(html, /shared demo credentials cannot identify individual reviewers/);
  assert.match(html, /No hosted login gate is currently configured/);
});

test('the team review module is registered as a served application asset', async () => {
  const routes = await readFile(new URL('../lib/public-files.mjs', import.meta.url), 'utf8');
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(routes, /\['\/team-review\.js','team-review\.js'\]/);
  assert.match(app, /from "\.\/team-review\.js"/);
});
