import test from 'node:test';
import assert from 'node:assert/strict';
import { cartonShellObj, reconstructDxfCarton } from '../public/cad-carton.js';
import { workbenchArtwork } from '../public/artwork-ui.js';

function sampleDxf({ units = 'millimeters', unsupportedEntities = [], depth = 30, crease = true } = {}) {
  const bounds = { minX: 0, maxX: 160, minY: -depth, maxY: 100 + depth };
  const page = { number: 1, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY, image: 'dieline.svg', unit: units };
  const rect = (face, sourceLabel, x0, y0, x1, y1) => ({
    page: 1, face, sourceLabel, layer: 'PANEL', area: (x1 - x0) * (y1 - y0) / (page.width * page.height),
    box: [(x0 - bounds.minX) / page.width, 1 - (y1 - bounds.minY) / page.height, (x1 - bounds.minX) / page.width, 1 - (y0 - bounds.minY) / page.height],
    points: [[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y]) => [(x-bounds.minX)/page.width, 1-(y-bounds.minY)/page.height]),
  });
  const vectorRegions = [
    rect('front', 'FRONT PANEL', 0, 0, 50, 100),
    rect('right', 'RIGHT SIDE', 50, 0, 50 + depth, 100),
    rect('back', 'BACK PANEL', 50 + depth, 0, 100 + depth, 100),
    rect('left', 'LEFT SIDE', 100 + depth, 0, 100 + 2 * depth, 100),
    rect('top', 'TOP PANEL', 0, 100, 50, 100 + depth),
    rect('bottom', 'BOTTOM PANEL', 0, -depth, 50, 0),
  ];
  const norm = ([x,y]) => [(x-bounds.minX)/page.width, 1-(y-bounds.minY)/page.height];
  const creasePoints = [[50,0,50,100],[50+depth,0,50+depth,100],[100+depth,0,100+depth,100],[0,0,50,0],[0,100,50,100]];
  return {
    name: 'rectangular-carton.dxf', pages: [page], vectorRegions,
    vectorGeometry: { format: 'DXF', units, unsupportedEntities },
    vectorLines: crease ? creasePoints.map(([x0,y0,x1,y1]) => ({ page: 1, kind: 'crease', points: [norm([x0,y0]), norm([x1,y1])] })) : [],
  };
}

test('reconstructs a dimensionally faithful shell from labeled DXF panels and explicit crease lines', () => {
  const model = reconstructDxfCarton(sampleDxf());
  assert.equal(model.ok, true);
  assert.deepEqual(model.dimensions, { width: 50, height: 100, depth: 30 });
  assert.equal(model.creaseCount, 5);
  assert.match(model.accuracyNote, /board thickness/);
  assert.equal(reconstructDxfCarton(sampleDxf({ units: 'inches' })).dimensions.width, 1270);
});

test('refuses unitless, unsupported, incomplete, and inconsistent CAD instead of guessing', () => {
  assert.match(reconstructDxfCarton(sampleDxf({ units: 'unitless' })).reason, /specify millimeters/);
  assert.match(reconstructDxfCarton(sampleDxf({ unsupportedEntities: ['SPLINE'] })).reason, /unsupported CAD entities/);
  assert.match(reconstructDxfCarton(sampleDxf({ crease: false })).reason, /explicit crease/);
  assert.match(reconstructDxfCarton({ ...sampleDxf(), vectorRegions: sampleDxf().vectorRegions.slice(1) }).reason, /front panel/);
  const inconsistent = sampleDxf();
  const back = inconsistent.vectorRegions.find(region => region.face === 'back');
  back.points = back.points.map(([x,y]) => [x > .8 ? x + 5 / inconsistent.pages[0].width : x, y]);
  assert.match(reconstructDxfCarton(inconsistent).reason, /consistent rectangular carton/);
  assert.match(reconstructDxfCarton(sampleDxf(), 'pouch').reason, /Only a rectilinear carton/);
});

test('exports a six-face OBJ outer shell in DXF millimeter dimensions with an honest scope note', () => {
  const model = reconstructDxfCarton(sampleDxf());
  const obj = cartonShellObj(model);
  assert.match(obj, /Units: millimeters/);
  assert.match(obj, /board thickness, tabs and detailed cut geometry omitted/);
  assert.equal((obj.match(/^v /gm) || []).length, 8);
  assert.equal((obj.match(/^f /gm) || []).length, 6);
  assert.match(obj, /^v -25 0 15$/m);
  assert.match(obj, /^v 25 100 -15$/m);
  assert.throws(() => cartonShellObj({ ok: false }), /validated DXF/);
});

test('confirmed custom reviews display DXF-dimensioned geometry while built-in samples stay illustrative', () => {
  const dxf = sampleDxf();
  const review = {
    id: 'custom-cad', name: 'Custom carton', options: { packageType: 'carton', packageMappingConfirmed: true, panelZones: { front: { page: 1, box: [.1,.1,.4,.8] } } },
    documents: [
      { id: 'art', role: 'artwork', name: 'artwork.png', pages: [{ number: 1, width: 600, height: 1200, image: 'art.png' }] },
      { id: 'die', role: 'dieline', ...dxf },
    ], findings: [],
  };
  const html = workbenchArtwork(review, null, { mode: '3d' });
  assert.match(html, /DXF-DIMENSIONED SHELL/);
  assert.match(html, /Export 3D outer shell \(\.obj\)/);
  assert.match(html, /50 × 100 × 30 mm/);
  assert.match(html, /data-geometry-source="dxf"/);

  const sample = { ...review, sample: 'fieldday' };
  const sampleHtml = workbenchArtwork(sample, null, { mode: '3d' });
  assert.doesNotMatch(sampleHtml, /DXF-DIMENSIONED SHELL/);
  assert.match(sampleHtml, /data-geometry-source="illustrative"/);
});
