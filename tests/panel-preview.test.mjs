import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedFacePreview, panelZoneMapper } from '../public/panel-zones.js';
import { sourcePreviewZones, workbenchArtwork } from '../public/artwork-ui.js';

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
