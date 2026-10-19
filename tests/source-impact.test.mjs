import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceImpactView } from '../public/source-impact.js';

test('source impact view explains value, checklist, finding, and decision changes safely', () => {
  const html = sourceImpactView({
    kind: 'sources',
    sourceDocuments: [{ role: 'spec', name: 'updated-spec.json', beforeName: 'spec-v1.json', afterName: 'updated-spec.json', change: 'updated' }],
    changedFacts: [{ documentId: 'spec', role: 'spec', name: 'updated-spec.json', field: 'net_quantity', label: 'Net quantity', before: [{ value: '750 mL', name: 'spec-v1.json', location: 'product.net_quantity' }], after: [{ value: '<1000 mL>', name: 'updated-spec.json', location: 'product.net_quantity' }] }],
    changedRequirements: [{ name: 'updated-checklist.json', location: 'quantity', change: 'updated', before: { text: 'Must show 750 mL.' }, after: { text: 'Must show 1000 mL.' } }],
    affectedFindings: [{ id: 'finding-1', title: 'Net quantity', before: 'issue', after: 'match' }],
    decisionRechecks: [{ findingId: 'finding-1', currentFindingId: 'finding-1', title: 'Net quantity', disposition: 'needs_changes', note: 'Fix mismatch.', status: 'issue', currentStatus: 'match' }],
  });
  assert.match(html, /SOURCE CHANGE IMPACT/);
  assert.match(html, /750 mL/);
  assert.match(html, /&lt;1000 mL&gt;/);
  assert.match(html, /Must show 750 mL\./);
  assert.match(html, /Findings affected/);
  assert.match(html, /Earlier reviewer decisions to recheck/);
  assert.match(html, /data-action="select-finding" data-id="finding-1"/);
  assert.doesNotMatch(html, /<1000 mL>/);
});

test('source impact view is absent from ordinary artwork revisions', () => {
  assert.equal(sourceImpactView({ kind: 'artwork' }), '');
});
