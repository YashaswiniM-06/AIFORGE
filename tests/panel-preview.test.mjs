import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedFacePreview, panelZoneMapper } from '../public/panel-zones.js';
import { captureFaceSuggestions, sourcePreviewZones, workbenchArtwork } from '../public/artwork-ui.js';

const review = () => ({id:'preview-check',sample:'organizer',options:{panelZones:{}},findings:[],documents:[{role:'artwork',name:'carton.pdf',pages:[{number:1,width:1800,height:1507,image:'page-1.png'},{number:2,width:900,height:1200,image:'page-2.png'}]}]});
test('each organizer face previews its own source crop without creating a mapping',()=>{
  const r=review(),before=JSON.stringify(r);
  const front=selectedFacePreview(r,{},'front'),back=selectedFacePreview(r,{},'back');
  assert.notEqual(front,back);
  assert.match(front,/Front panel artwork crop/);assert.match(back,/Back panel artwork crop/);
  assert.match(front,/Organizer preview · not a saved map/);
  assert.equal(JSON.stringify(r),before);
  const zones=sourcePreviewZones(r);zones.front.box[0]=0;
  assert.notEqual(sourcePreviewZones(r).front.box[0],0);
});
test('new upload face mapper labels the whole-page illustration and asks for a real face map',()=>{
  const r=review();r.id='new-upload';r.sample=undefined;r.options.panelZones={};
  const html=selectedFacePreview(r,r.options.panelZones,'front');
  assert.match(html,/Full page preview · not a saved map/);
  assert.match(html,/complete supplied page is shown as an illustration only/);
  assert.doesNotMatch(html,/Organizer preview/);
  assert.match(panelZoneMapper(r),/Draw each supplied artwork face/);
});
test('mapped faces override sample crops and show the correct page and draft status',()=>{
  const r=review(),zones={front:{page:2,box:[.1,.2,.7,.8]}};
  const html=selectedFacePreview(r,zones,'front',true);
  assert.match(html,/page-2.png/);assert.match(html,/Unsaved face crop/);assert.doesNotMatch(html,/Organizer preview/);
  assert.match(selectedFacePreview(r,zones,'front'),/Saved face crop/);
  assert.match(selectedFacePreview(r,{},'top'),/No artwork mapped/);
  assert.doesNotMatch(selectedFacePreview(r,{front:{page:1,box:[0,0,0,0]}},'front',true),/NaN|Infinity/);
});
test('mapping a single organizer face preserves the other source preview faces',()=>{
  const r=review();r.options.panelZones.front={page:2,box:[.1,.2,.7,.8]};
  const html=workbenchArtwork(r,null,{mode:'3d'});
  assert.match(html,/data-carton-face="front"[^>]*>[\s\S]*?page-2.png/);
  const right=html.split('data-carton-face="right"')[1].split('</div>')[0];
  assert.match(right,/page-1.png/);
  assert.doesNotMatch(right,/carton-pin/);
  assert.deepEqual(Object.keys(r.options.panelZones),['front']);
});
test('mapping form exposes an immediate selected-face preview',()=>{
  const html=panelZoneMapper(review());
  assert.match(html,/Preview \/ map face/);
  assert.match(html,/data-zone-face-preview aria-live="polite"/);
  assert.match(html,/Front panel artwork crop/);
});

test('captured face photos preview their own pages and remain unconfirmed until mapped',()=>{
  const r=review();delete r.sample;
  r.options.captureFaces=[{page:1,face:'front',box:[0,0,1,.96]},{page:2,face:'back',box:[0,0,1,.95]}];
  const before=structuredClone(r);
  assert.deepEqual(sourcePreviewZones(r),{
    front:{page:1,box:[0,0,1,.96]},back:{page:2,box:[0,0,1,.95]},
  });
  const html=workbenchArtwork(r,null,{mode:'3d'});
  assert.match(html,/Captured photos · preview only/);
  assert.match(html,/data-carton-face="back"[^>]*>[\s\S]*?page-2.png/);
  assert.match(html,/face names chosen during capture/);
  assert.doesNotMatch(html,/data-cad-export|data-geometry-source="dxf"|carton-pin /);
  assert.match(selectedFacePreview(r,{},'back'),/Captured face photo · not a saved map/);
  assert.deepEqual(r,before);
});

test('ambiguous and invalid capture faces never become geometry suggestions',()=>{
  const r=review();delete r.sample;
  r.options.captureFaces=[
    {page:1,face:'front',box:[0,0,1,.96]}, {page:2,face:'front',box:[0,0,1,.96]},
    {page:1,face:'unassigned',box:[0,0,1,.96]}, {page:9,face:'back',box:[0,0,1,.96]},
    {page:1,face:'right',box:[-.1,0,1,.96]}, {page:1,face:'bottom',box:[.5,0,.4,.96]},
  ];
  assert.deepEqual(captureFaceSuggestions(r),{});
  r.sample='organizer';r.options.captureFaces=[{page:2,face:'front',box:[0,0,1,1]}];
  assert.deepEqual(captureFaceSuggestions(r),{});
  assert.equal(sourcePreviewZones(r).front.page,1);
});

test('unlabelled video stills offer explicit face mapping without silently confirming geometry',()=>{
  const r=review();delete r.sample;
  r.options.captureFaces=[
    {page:1,face:'unassigned',box:[0,0,1,1]},
    {page:2,face:'unassigned',box:[0,0,1,1]},
  ];
  const html=panelZoneMapper(r);
  assert.match(html,/Assign video frames to package faces/);
  assert.match(html,/Unlabelled video frames do not reveal their orientation automatically/);
  assert.match(html,/data-capture-map-face="1"/);
  assert.match(html,/data-capture-map-page="2"/);
  assert.match(html,/data-package-confirm[^>]*disabled/);
  assert.doesNotMatch(html,/data-package-confirm[^>]*checked/);
  const preview=workbenchArtwork(r,null,{mode:'3d'});
  assert.match(preview,/2 video frames · assign faces/);
  assert.match(preview,/Video stills are not orientation-labeled/);
});

test('camera-only face mapper permits package selection and confirmation without a dieline',()=>{
  const r=review();delete r.sample;
  r.options.captureFaces=[{page:1,face:'front',box:[0,0,1,.96]}];
  const empty=panelZoneMapper(r);
  assert.match(empty,/PHOTO & ARTWORK PACKAGE PREVIEW/);
  assert.match(empty,/name="packageType"/);
  assert.match(empty,/Use labelled photos as starting crops/);
  assert.match(empty,/data-zone-page-use/);
  assert.match(empty,/data-package-confirm[^>]*disabled/);
  r.options.panelZones.front={page:1,box:[.1,.1,.8,.9]};
  r.options.packageMappingConfirmed=true;
  assert.match(panelZoneMapper(r),/data-package-confirm checked/);
  assert.doesNotMatch(panelZoneMapper(review()),/PHOTO & ARTWORK PACKAGE PREVIEW|data-zone-page-use/);
});

test('photo reviews use each selected package shape without granting a CAD export',()=>{
  for(const type of ['pouch','bottle_label','sleeve']){
    const r=review();delete r.sample;
    r.options={packageType:type,packageMappingConfirmed:true,panelZones:{front:{page:1,box:[.1,.1,.8,.9]},back:{page:2,box:[.1,.1,.8,.9]}}};
    const html=workbenchArtwork(r,null,{mode:'3d'});
    assert.match(html,new RegExp(`class="carton-model package-${type.replace('_','-')}"`));
    assert.match(html,/data-geometry-source="illustrative"/);
    assert.doesNotMatch(html,/data-cad-export/);
  }
});
