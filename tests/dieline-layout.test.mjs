import test from 'node:test';
import assert from 'node:assert/strict';
import { packageFaceLabel, packageType, suggestDielineMapping } from '../public/dieline-layout.js';
import { panelZoneMapper } from '../public/panel-zones.js';
import { workbenchArtwork } from '../public/artwork-ui.js';

const dieline = {
  id: 'die', name: 'carton-dieline.pdf', role: 'dieline',
  pages: [{ number: 1, width: 1200, height: 800, image: 'die-p1.png' }],
  panelLabels: [
    { text: 'BACK PANEL', page: 1, box: [.04, .04, .16, .07] },
    { text: 'LEFT SIDE', page: 1, box: [.28, .04, .38, .07] },
    { text: 'FRONT PANEL', page: 1, box: [.53, .04, .65, .07] },
    { text: 'RIGHT SIDE', page: 1, box: [.78, .04, .90, .07] },
  ],
};

test('positioned dieline labels suggest editable face regions and boundary cues', () => {
  const result = suggestDielineMapping(dieline, 'carton');
  assert.deepEqual(Object.keys(result.zones), ['back', 'left', 'front', 'right']);
  assert.equal(result.zones.back.page, 1);
  assert.equal(result.zones.back.box[0], 0);
  assert.equal(result.zones.right.box[2], 1);
  assert.equal(result.folds.length, 3);
  assert.match(result.note, /Positioned face labels suggest identities/);
  assert.equal(result.faces.filter(face => face.suggested).length, 4);
});

test('unlabelled dielines receive face names only, never invented coordinates or fold paths', () => {
  const result = suggestDielineMapping({ panelLabels: [] }, 'pouch');
  assert.deepEqual(result.zones, {});
  assert.deepEqual(result.folds, []);
  assert.deepEqual(result.faces.map(face => face.face), ['front', 'back', 'left', 'right', 'bottom']);
  assert.match(result.note, /no positioned face labels or clear long straight lines were found/i);
  assert.equal(packageType('bottle_label').faces.includes('top'), false);
});

test('long line candidates from unlabeled raster dielines show unassigned regions and boundary cues', () => {
  const result = suggestDielineMapping({ structuralEdges: [
    ...[.03, .30, .50, .73, .97].map(position => ({ page: 1, axis: 'vertical', position, extent: [.05, .95] })),
    ...[.05, .95].map(position => ({ page: 1, axis: 'horizontal', position, extent: [.03, .97] })),
  ] }, 'carton');
  assert.equal(result.zones.front, undefined, 'line geometry does not invent face identities');
  assert.equal(result.folds.length, 7);
  assert.equal(result.candidateRegions.length, 4);
  assert.match(result.note, /unlabelled regions were found/);
});

test('package types expose the expected reviewer-mappable faces and terminology', () => {
  assert.deepEqual(packageType('carton').faces, ['front', 'back', 'left', 'right', 'top', 'bottom']);
  assert.deepEqual(packageType('pouch').faces, ['front', 'back', 'left', 'right', 'bottom']);
  assert.deepEqual(packageType('bottle_label').faces, ['front', 'back', 'left', 'right']);
  assert.deepEqual(packageType('sleeve').faces, ['front', 'back', 'left', 'right']);
  assert.equal(packageFaceLabel('pouch', 'left'), 'Left gusset');
  assert.equal(packageFaceLabel('bottle_label', 'left'), 'Wrap left');
});

test('dieline mapper requires an artwork front crop before reviewer confirmation', () => {
  const review = {
    id: 'custom-review', options: { packageType: 'pouch', panelZones: {} }, findings: [],
    documents: [
      { role: 'artwork', pages: [{ number: 1, width: 1200, height: 800, image: 'art-p1.png' }] },
      dieline,
    ],
  };
  const html = panelZoneMapper(review);
  assert.match(html, /DIELINE-AWARE PACKAGE PREVIEW/);
  assert.match(html, /Copy face regions to artwork map/);
  assert.match(html, /name="packageType"/);
  assert.match(html, /data-package-confirm[^>]*disabled/);
  assert.match(html, /Line style alone cannot distinguish cut from crease/);
});

test('unlabeled structural edges render as candidates without assigning face names', () => {
  const review = { ...{
    id: 'custom-review', options: { packageType: 'carton', panelZones: {} }, findings: [],
    documents: [
      { role: 'artwork', pages: [{ number: 1, width: 1200, height: 800, image: 'art.png' }] },
      { role: 'dieline', pages: [{ number: 1, width: 1200, height: 800, image: 'die.png' }], panelLabels: [], structuralEdges: [
        { page: 1, axis: 'vertical', position: .25, extent: [.1, .9] },
        { page: 1, axis: 'vertical', position: .5, extent: [.1, .9] },
        { page: 1, axis: 'vertical', position: .75, extent: [.1, .9] },
        { page: 1, axis: 'horizontal', position: .1, extent: [.2, .8] },
        { page: 1, axis: 'horizontal', position: .9, extent: [.2, .8] },
      ] },
    ],
  } };
  const html = panelZoneMapper(review);
  assert.match(html, /Unlabelled region 1/);
  assert.match(html, /dieline-fold vertical candidate-edge/);
  assert.match(html, /assign faces manually/);
  assert.doesNotMatch(html, /Mapped face Front/);
});

test('3D package preview stays hidden until confirmation, then uses the selected package form', () => {
  const review = {
    id: 'custom-review', options: { packageType: 'pouch', packageMappingConfirmed: false, panelZones: {} },
    documents: [
      { id: 'art', role: 'artwork', name: 'artwork.pdf', pages: [{ number: 1, width: 1200, height: 800, unit: 'pt', image: 'art-p1.png' }] },
      dieline,
    ],
    findings: [],
  };
  const waiting = workbenchArtwork(review, null, { mode: '3d' });
  assert.match(waiting, /Confirm the dieline mapping first/);
  assert.doesNotMatch(waiting, /class="carton-model package-pouch"/);

  review.options.packageMappingConfirmed = true;
  review.options.panelZones = {
    front: { page: 1, box: [.5, 0, .74, 1] },
    back: { page: 1, box: [.02, 0, .25, 1] },
  };
  const confirmed = workbenchArtwork(review, null, { mode: '3d' });
  assert.match(confirmed, /class="carton-model package-pouch"/);
  assert.match(confirmed, /POUCH PREVIEW/);
  assert.match(confirmed, /Mapped face Front/);
});

test('each supported confirmed package type renders its own illustrative form', () => {
  for (const [type, title] of [['carton', 'CARTON'], ['pouch', 'POUCH'], ['bottle_label', 'BOTTLE LABEL'], ['sleeve', 'SLEEVE']]) {
    const review = {
      id: `custom-${type}`, options: { packageType: type, packageMappingConfirmed: true, panelZones: {
        front: { page: 1, box: [.1, .1, .9, .9] },
        back: { page: 1, box: [.02, .1, .25, .9] },
      } },
      documents: [
        { id: 'art', role: 'artwork', name: 'artwork.pdf', pages: [{ number: 1, width: 1200, height: 800, unit: 'pt', image: 'art-p1.png' }] },
        dieline,
      ],
      findings: [],
    };
    const html = workbenchArtwork(review, null, { mode: '3d' });
    const cssType = type.replace('_', '-');
    assert.match(html, new RegExp(`class="carton-model package-${cssType}"`));
    assert.match(html, new RegExp(`${title} PREVIEW`));
    assert.match(html, /Mapped face Front/);
  }
});

test('custom pouch proportions respond to the mapped artwork crop', () => {
  const render = front => workbenchArtwork({
    id: 'custom-pouch', options: { packageType: 'pouch', packageMappingConfirmed: true, panelZones: { front } },
    documents: [
      { role: 'artwork', name: 'artwork.pdf', pages: [{ number: 1, width: 1200, height: 800, unit: 'pt', image: 'art.png' }] },
      dieline,
    ], findings: [],
  }, null, { mode: '3d' });
  const tall = render({ page: 1, box: [.1, .1, .4, .9] });
  const wide = render({ page: 1, box: [.1, .1, .9, .45] });
  const extractDimensions = html => html.match(/data-carton-width="(\d+)" data-carton-height="(\d+)" data-carton-depth="(\d+)"/).slice(1).map(Number);
  assert.notDeepEqual(extractDimensions(tall), extractDimensions(wide));
});
