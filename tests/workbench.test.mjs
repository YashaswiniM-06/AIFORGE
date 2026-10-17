import test from 'node:test';
import assert from 'node:assert/strict';
import { artworkMap, findingVisual, workbenchArtwork } from '../public/artwork-ui.js';
import { panelZoneMapper } from '../public/panel-zones.js';
import { reviewPipeline } from '../public/review-pipeline.js';

const review={
  id:'review-demo',
  documents:[{id:'art',name:'carton.pdf',role:'artwork',sha256:'a'.repeat(64),pages:[{number:1,width:1200,height:860,unit:'pt',image:'page-1.png'}]}],
  findings:[],counts:{issue:1,review:2,match:4,unable:0},rules:[{id:'quantity'}],conflicts:[{field:'net_quantity'}],
  options:{panelZones:{front:{page:1,box:[0.05,0.05,0.75,0.95]}}},
};
const finding={
  id:'quantity',title:'Net quantity mismatch',status:'issue',expected:'1000 mL',observed:'750 mL',
  evidence:[{documentId:'art',name:'carton.pdf',role:'artwork',quote:'NET 750 mL',page:1,box:[0.12,0.76,0.48,0.84],location:'Page 1'}],
};
review.findings=[finding];

test('2D workbench shows the located artwork and red-green source comparison',()=>{
  const html=workbenchArtwork(review,finding,{mode:'2d',pageNumber:1,activeEvidenceIndex:0});
  assert.match(html,/Original artwork page 1/);
  assert.match(html,/workbench-region issue/);
  assert.match(html,/workbench-diff-actual/);
  assert.match(html,/ARTWORK SAYS/);
  assert.match(html,/SUPPLIED SOURCE/);
  assert.match(html,/1000 mL/);
});

test('3D fold context maps reviewer panels and exposes selectable evidence pins',()=>{
  const html=workbenchArtwork(review,finding,{mode:'3d',pageNumber:1,activeEvidenceIndex:0,cartonRotation:45});
  assert.match(html,/class="carton-rotate">Rotate/);
  assert.match(html,/data-carton-rotation/);
  assert.match(html,/rotateY\(45deg\)/);
  assert.match(html,/data-carton-scene/);
  assert.match(html,/data-carton-face="front"/);
  assert.match(html,/carton-pin issue/);
  assert.match(html,/carton-pin issue selected/);
  assert.match(html,/aria-pressed="true"/);
  assert.match(html,/Illustrative 3D context/);
  assert.match(html,/LOCATED ON · FRONT/);
  assert.doesNotMatch(html,/carton-context-reveal|carton-focus-strip|carton-replay/);
  assert.match(html,/aria-label="Front panel"/);
  assert.match(html,/Select a mapped finding pin to inspect evidence/);
  assert.match(html,/Cut, crease, and glue geometry are not inferred/i);
});

test('3D context does not claim a precise panel location when a finding has no mapped artwork box',()=>{
  const html=workbenchArtwork(review,{...finding,evidence:[]},{mode:'3d'});
  assert.match(html,/LOCATION NOT MAPPED · FRONT/);
  assert.match(html,/Illustrative 3D context/);
});

test('3D context keeps an interactive neutral carton for a non-sample review with no mapped artwork',()=>{
  const unmapped={...review,options:{panelZones:{}}};
  const html=workbenchArtwork(unmapped,finding,{mode:'3d'});
  assert.match(html,/carton-stage unmapped-preview/);
  assert.match(html,/data-carton-rotation/);
  assert.match(html,/data-carton-face="front"/);
  assert.match(html,/NO ARTWORK PANELS MAPPED/);
  assert.match(html,/No artwork texture is inferred/);
  assert.match(html,/Map faces →/);
});

test('organizer sample gets a non-persistent visual carton mockup from complete panel crops',()=>{
  const sample={...review,sample:'organizer',options:{panelZones:{}}};
  const html=workbenchArtwork(sample,finding,{mode:'3d'});
  assert.match(html,/carton-face carton-front preview-only/);
  assert.match(html,/carton-face carton-back preview-only/);
  assert.match(html,/carton-face carton-right preview-only/);
  assert.match(html,/ILLUSTRATIVE SAMPLE PREVIEW · FACE MAPPING NOT SAVED/);
  assert.match(html,/not saved panel geometry and not used to calculate findings/);
  assert.match(html,/Visual sample · 0 geometry maps/);
  assert.match(html,/--carton-w:198px;--carton-h:260px;--carton-d:58px/);
  assert.match(html,/rotateY\(-22deg\)/);
  assert.match(html,/style="width:342\.4657\d+%;height:317\.4603\d+%;left:-180\.8219\d+%;top:-117\.4603\d+%"/);
  assert.doesNotMatch(html,/carton-pin /);
});

test('the fold model renders all six explicitly mapped carton faces',()=>{
  const mapped={...review,options:{panelZones:Object.fromEntries([
    ['front',[.05,.05,.45,.95]],['back',[.55,.05,.72,.95]],['left',[.73,.05,.8,.95]],
    ['right',[.81,.05,.88,.95]],['top',[.05,.02,.45,.09]],['bottom',[.05,.91,.45,.98]],
  ].map(([name,box])=>[name,{page:1,box}]))}};
  const html=workbenchArtwork(mapped,finding,{mode:'3d'});
  for(const face of ['front','back','left','right','top','bottom'])assert.match(html,new RegExp(`carton-face carton-${face} mapped`));
  assert.match(html,/Side depth follows the reviewer-drawn side panel/);
});

test('2D prepress HUD includes calibrated PDF coordinates, layer controls, zoom and source hash state',()=>{
  const html=workbenchArtwork(review,finding,{mode:'2d',pageNumber:1,activeEvidenceIndex:0});
  assert.match(html,/data-workbench-zoom/);
  assert.match(html,/data-layer-boxes/);
  assert.match(html,/data-layer-zones/);
  assert.match(html,/hide-zones/);
  assert.match(html,/data-unit="pt"/);
  assert.match(html,/data-source-hash/);
  assert.match(html,/The 2D proof is unaltered/);
});

test('panel mapper shows the supplied face impact without adding reviewer-authored placement checks',()=>{
  const html=panelZoneMapper(review);
  assert.match(html,/Only supplied checklist checks assigned to that face are recalculated/);
  assert.match(html,/data-zone-impact/);
  assert.doesNotMatch(html,/reviewerPanelRequirements|placement check/i);
  assert.match(html,/value="left"/);
  assert.match(html,/value="right"/);
});

test('proof dialog artwork starts centered on the evidence with an adjustable spotlight',()=>{
  const html=findingVisual(review,finding);
  assert.match(html,/data-proof-spotlight/);
  assert.match(html,/data-proof-zoom/);
  assert.match(html,/data-trace-target/);
  assert.match(html,/OBSERVED ARTWORK/);
});

test('artwork coverage map does not add a synthetic placement guide',()=>{
  const html=artworkMap({...review,options:{panelZones:{front:{page:1,box:[.1,.1,.9,.9]}}}});
  assert.doesNotMatch(html,/LOWER 30% GUIDE|placement-guide/);
  assert.match(html,/No located check/);
});

test('review pipeline reports actual unresolved sources and does not claim a seal before export',()=>{
  const html=reviewPipeline(review,'findings');
  assert.match(html,/Sources &amp; authority/);
  assert.match(html,/1 input · 1 open decision/);
  assert.match(html,/Artwork verification/);
  assert.match(html,/1 supported or retained check/);
  assert.match(html,/1 issue · 2 for review/);
  assert.match(html,/Seal is created when you export/);
});
