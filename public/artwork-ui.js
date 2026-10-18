import { mountViewport } from "./artwork-viewport.js";
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label={match:'Matches reference',issue:'Issue found',review:'Human review',unable:'Unable to verify'};
const artwork=review=>review.documents?.find(d=>d.role==='artwork');
const evidenceFor=(review,page)=>{
  const results=new Map();
  for(const finding of review.findings||[])for(const proof of finding.evidence||[]){
    if(proof.role!=='artwork'||proof.page!==page||!Array.isArray(proof.box))continue;
    const key=proof.box.map(n=>Number(n).toFixed(3)).join(',');const rank={unable:1,match:2,review:3,issue:4};const before=results.get(key);
    if(!before||rank[finding.status]>rank[before.status])results.set(key,{...proof,status:finding.status,id:finding.id,title:finding.title});
  }
  return [...results.values()];
};
function image(review,page){return `/api/reviews/${encodeURIComponent(review.id)}/images/${encodeURIComponent(page.image)}`;}
export function artworkMap(review,{page=1}={}){
  const doc=artwork(review);if(!doc)return '<div class="panel">Artwork was not available for this review.</div>';
  const current=doc.pages.find(p=>p.number===page)||doc.pages[0],regions=evidenceFor(review,current.number),located=regions.length,unlocated=(review.findings||[]).filter(f=>!f.evidence?.some(e=>e.role==='artwork'&&e.box)).length;
  return `<section class="artwork-map panel" data-artwork-map><div class="artwork-map-head"><div><div class="eyebrow">ARTWORK CHECK COVERAGE</div><h3>See what each supported check touched</h3><p class="subtle">Color represents the outcome of a located check. It is not a confidence score, release grade, or a claim that uncolored artwork was checked.</p></div><label class="field compact"><span>Artwork page</span><select data-art-page>${doc.pages.map(p=>`<option value="${p.number}" ${p.number===current.number?'selected':''}>Page ${p.number}</option>`).join('')}</select></label></div><div class="coverage-legend" aria-label="Check coverage legend"><span class="map-key match">Matched check</span><span class="map-key review">Human review</span><span class="map-key issue">Issue</span><span class="map-key neutral">No located check</span></div><div class="coverage-stage"><img src="${image(review,current)}" alt="Artwork page ${current.number} with check-coverage overlays">${regions.map(r=>`<button type="button" class="coverage-region ${r.status}" data-action="proof" data-id="${esc(r.id)}" style="left:${r.box[0]*100}%;top:${r.box[1]*100}%;width:${(r.box[2]-r.box[0])*100}%;height:${(r.box[3]-r.box[1])*100}%" aria-label="${esc(label[r.status])}: ${esc(r.title)}"><span>${esc(r.status==='match'?'✓':r.status==='issue'?'!':'?')}</span></button>`).join('')}</div><p class="subtle coverage-summary">${located} located finding${located===1?'':'s'} on this page. ${unlocated} finding${unlocated===1?'':'s'} without a precise artwork region remain listed in Findings.</p></section>`;
}
function viewportToolbar({spotlight=false,zoom=100,hasFocus=false}={}){
  return `<div class="artwork-navigation ${spotlight?'spotlight-navigation':''}" aria-label="Artwork navigation">
    <div class="artwork-zoom-group"><button type="button" class="viewer-icon-button" data-viewport-step="-0.25" aria-label="Zoom out" title="Zoom out">−</button>
    <label class="hud-zoom"><span class="sr-only">Zoom</span><input type="range" min="100" max="400" step="1" value="${Math.max(100,Math.min(400,zoom))}" ${spotlight?'data-proof-zoom':'data-workbench-zoom'} aria-label="${spotlight?'Artwork spotlight zoom':'Artwork zoom'}"><output>${Math.round(zoom)}%</output></label>
    <button type="button" class="viewer-icon-button" data-viewport-step="0.25" aria-label="Zoom in" title="Zoom in">+</button></div>
    <div class="artwork-view-actions"><button type="button" data-viewport-fit>Fit page</button><button type="button" data-viewport-focus ${hasFocus?'':'disabled'}>Focus evidence</button></div>
    <div class="artwork-pan-buttons" role="group" aria-label="Pan artwork"><button type="button" data-viewport-pan="-1,0" aria-label="Pan left" title="Pan left">←</button><button type="button" data-viewport-pan="0,-1" aria-label="Pan up" title="Pan up">↑</button><button type="button" data-viewport-pan="0,1" aria-label="Pan down" title="Pan down">↓</button><button type="button" data-viewport-pan="1,0" aria-label="Pan right" title="Pan right">→</button></div>
  </div>`;
}
export function findingVisual(review,finding){
  const doc=artwork(review),proof=finding.evidence?.find(e=>e.role==='artwork'&&e.page&&Array.isArray(e.box));if(!doc||!proof)return `<section class="visual-diff unavailable"><h3>Visual comparison</h3><p class="subtle">No precise artwork location was extracted for this finding. The source and observed values below remain the evidence to inspect.</p></section>`;
  const page=doc.pages.find(p=>p.number===proof.page);if(!page)return '';
  const [x0,y0,x1,y1]=proof.box;
  return `<section class="visual-diff"><div><div class="eyebrow">VISUAL COPY COMPARISON</div><h3>${finding.status==='issue'?'Observed copy and supplied reference':'Located artwork evidence'}</h3><p class="subtle">Inspect the highlighted source artwork. Drag to pan, or use the arrows below.</p></div><div class="proof-spotlight-frame diff-stage" tabindex="0" role="group" aria-label="Evidence spotlight. Drag or use arrow keys to pan. Plus and minus zoom. Home fits the page." data-proof-spotlight data-start-focused data-page-width="${page.width}" data-page-height="${page.height}" data-focus-box="${proof.box.join(',')}"><div class="proof-spotlight-content" data-proof-spotlight-content><img src="${image(review,page)}" draggable="false" alt="Artwork page ${page.number}"><div class="spotlight-highlight" data-trace-target style="left:${x0*100}%;top:${y0*100}%;width:${(x1-x0)*100}%;height:${(y1-y0)*100}%"><span>OBSERVED ARTWORK</span></div></div></div>${viewportToolbar({spotlight:true,hasFocus:true})}<div class="diff-values"><div class="observed"><small>Observed artwork text</small><p>${esc(finding.observed||'Not detected')}</p></div><div class="reference"><small>Supplied reference</small><p>${esc(finding.expected||'No value')}</p></div></div></section>`;
}
const faceLabels={front:'Front',back:'Back',left:'Left side',right:'Right side',top:'Top',bottom:'Bottom'};
const findingSymbols={issue:'!',review:'?',unable:'—',match:'✓'};
const compactText=(value,limit=52)=>{const text=String(value??'').replace(/\s+/g,' ').trim();return text.length>limit?`${text.slice(0,limit-1).trimEnd()}…`:text;};
// These regions are used only to make the organizer's supplied dieline legible as a visual mockup.
// They are never persisted as panel mappings and never participate in rule geometry or findings.
const organizerVisualZones={
  back:{page:1,box:[.04,.375,.335,.786]},
  left:{page:1,box:[.346,.375,.514,.786]},
  front:{page:1,box:[.528,.375,.82,.786]},
  right:{page:1,box:[.834,.375,.993,.786]},
};
// Non-persistent visual crops for the established built-in samples. Unknown
// uploads show a whole-page illustration until a reviewer maps real faces.
export function sourcePreviewZones(review){
  if(review?.sample==='organizer')return structuredClone(organizerVisualZones);
  if(!review||review.id==='review-demo')return {};
  const doc=artwork(review),page=doc?.pages?.[0];
  if(!page)return {};
  // A new upload has no trustworthy face map. Show its complete first page as
  // an illustrative front only; a reviewer must define the actual package faces.
  // Built-in samples retain their established preview geometry below.
  if(!review.sample)return {front:{page:page.number,box:[0,0,1,1]}};
  const pw=Number(page.width)||1200,ph=Number(page.height)||800,ratio=pw/ph;
  const pageBoxes=(review?.findings||[])
    .flatMap(f=>f.evidence||[])
    .filter(e=>e.role==='artwork'&&(!e.page||e.page===page.number)&&Array.isArray(e.box)&&e.box.length===4)
    .map(e=>e.box);

  let y0=0.05,y1=0.95;
  if(pageBoxes.length>=2){
    const minY=Math.min(...pageBoxes.map(b=>b[1])),maxY=Math.max(...pageBoxes.map(b=>b[3]));
    y0=Math.max(0.02,Math.min(0.20,minY-0.06));
    y1=Math.min(0.98,Math.max(0.78,maxY+0.06));
  }

  // 1. Dieline / wide packaging layout (ratio >= 1.45)
  if(ratio>=1.45){
    return {
      back: {page:page.number,box:[0.02,y0,0.25,y1]},
      left: {page:page.number,box:[0.26,y0,0.49,y1]},
      front:{page:page.number,box:[0.50,y0,0.74,y1]},
      right:{page:page.number,box:[0.75,y0,0.98,y1]}
    };
  }

  // 2. Dual-panel artwork (1.1 <= ratio < 1.45) e.g. Fieldday. These source
  // panels do not contain enough geometry to invent carton side artwork.
  if(ratio>=1.1){
    const brandFinding=(review?.findings||[]).find(f=>/brand|identity|variant|product|title/i.test(f.title||f.rule?.id||''));
    const brandBox=brandFinding?.evidence?.find(e=>e.role==='artwork'&&Array.isArray(e.box))?.box;
    const frontOnRight=brandBox?((brandBox[0]+brandBox[2])/2>0.5):true;
    if(frontOnRight){
      return {
        front:{page:page.number,box:[0.51,y0,0.98,y1]},
        back: {page:page.number,box:[0.02,y0,0.49,y1]}
      };
    }else{
      return {
        front:{page:page.number,box:[0.02,y0,0.49,y1]},
        back: {page:page.number,box:[0.51,y0,0.98,y1]}
      };
    }
  }

  // 3. Single-panel / portrait / bottle / pouch. Keep the remaining faces
  // visibly unmapped until the reviewer supplies their artwork.
  return {
    front:{page:page.number,box:[0.02,y0,0.98,y1]}
  };
}
function faceTexture(review,zone){
  const doc=artwork(review),page=doc?.pages?.find(p=>p.number===zone.page);if(!page||!zone.box)return '<span class="carton-unmapped">Panel not mapped</span>';
  const [x0,y0,x1,y1]=zone.box,w=Math.max(.001,x1-x0),h=Math.max(.001,y1-y0);
  return `<img src="${image(review,page)}" alt="Mapped ${esc(faceLabels[zone.name]||zone.name)} artwork panel" style="width:${100/w}%;height:${100/h}%;left:${-100*x0/w}%;top:${-100*y0/h}%">`;
}
function facePins(review,zone,selectedFindingId){
  if(!zone?.box)return '';
  const [x0,y0,x1,y1]=zone.box,w=x1-x0,h=y1-y0,pins=[];
  for(const finding of review.findings||[])for(const [index,item] of (finding.evidence||[]).entries()){
    if(item.role!=='artwork'||item.page!==zone.page||!Array.isArray(item.box))continue;
    const x=(item.box[0]+item.box[2])/2,y=(item.box[1]+item.box[3])/2;
    if(x<x0||x>x1||y<y0||y>y1)continue;
    const selected=finding.id===selectedFindingId;
    pins.push(`<button type="button" class="carton-pin ${esc(finding.status)} ${selected?'selected':''}" data-action="select-finding" data-id="${esc(finding.id)}" data-evidence-index="${index}" style="left:${(x-x0)/w*100}%;top:${(y-y0)/h*100}%" aria-label="Open ${esc(finding.title)}" aria-pressed="${selected}" title="${esc(finding.title)}">${findingSymbols[finding.status]||'•'}</button>`);
  }
  return pins.join('');
}
// Render a rectangular evidence-box overlay on the 3D face for the selected finding.
// This mirrors the 2D workbench-region boxes so reviewers see the same boundary in 3D.
function faceEvidenceBoxes(review,zone,selectedFindingId,activeEvidenceIndex=0){
  if(!zone?.box||!selectedFindingId)return '';
  const [x0,y0,x1,y1]=zone.box,w=x1-x0,h=y1-y0,boxes=[];
  const finding=review.findings?.find(f=>f.id===selectedFindingId);
  if(!finding)return '';
  const artworkEvidence=(finding.evidence||[]).map((item,index)=>({item,index})).filter(({item})=>item.role==='artwork'&&item.page===zone.page&&Array.isArray(item.box));
  for(const {item,index} of artworkEvidence){
    const [bx0,by0,bx1,by1]=item.box;
    const cx=(bx0+bx1)/2,cy=(by0+by1)/2;
    if(cx<x0||cx>x1||cy<y0||cy>y1)continue;
    const lp=Math.max(0,((bx0-x0)/w*100)).toFixed(2),tp=Math.max(0,((by0-y0)/h*100)).toFixed(2);
    const wp=Math.min(100-lp,((bx1-bx0)/w*100)).toFixed(2),hp=Math.min(100-tp,((by1-by0)/h*100)).toFixed(2);
    const isSelected=index===activeEvidenceIndex;
    boxes.push(`<div class="carton-evidence-box ${esc(finding.status)} ${isSelected?'selected':''}" aria-hidden="true" style="left:${lp}%;top:${tp}%;width:${wp}%;height:${hp}%"><span>${isSelected?'Selected':esc(finding.status==='match'?'✓':finding.status==='issue'?'!':'Evidence')}</span></div>`);
  }
  return boxes.join('');
}
function foldedDimensions(review,zones){
  const front=zones.front,side=zones.right||zones.left,frontPage=front&&artwork(review)?.pages?.find(p=>p.number===front.page),sidePage=side&&artwork(review)?.pages?.find(p=>p.number===side.page);
  if(!front?.box||!frontPage)return {width:198,height:260,depth:58,measured:false};
  const fw=(front.box[2]-front.box[0])*frontPage.width,fh=(front.box[3]-front.box[1])*frontPage.height;
  const depth=side?.box&&sidePage?(side.box[2]-side.box[0])*sidePage.width:fw*.26;
  // Keep the complete carton inside the proof stage. The former 340 × 280 × 128
  // caps made its projected silhouette wider/taller than the viewport, clipping
  // the source textures and making the dieline colors look like stray patches.
  const scale=Math.min(270/Math.max(fh,1),205/Math.max(fw,1),88/Math.max(depth,1));
  return {width:Math.round(fw*scale),height:Math.round(fh*scale),depth:Math.round(depth*scale),measured:Boolean(side?.box)};
}
export function workbenchArtwork(review,finding,{mode='2d',pageNumber=1,activeEvidenceIndex=0,cartonRotation=null,cartonTilt=-7,zoom=100,showBoxes=true,showZones=false}={}){
  const doc=artwork(review);if(!doc?.pages?.length)return '<div class="workbench-empty">No rendered artwork page is available.</div>';
  const artworkEvidence=(finding?.evidence||[]).map((item,index)=>({item,index})).filter(({item})=>item.role==='artwork'&&item.page);
  const selected=artworkEvidence.find(({index})=>index===activeEvidenceIndex)||artworkEvidence[0];
  const pageOptions=[...new Set([...(doc.pages||[]).map(p=>p.number),...artworkEvidence.map(({item})=>item.page)])].sort((a,b)=>a-b);
  const page=doc.pages.find(p=>p.number===Number(pageNumber))||doc.pages.find(p=>p.number===selected?.item.page)||doc.pages[0];
  const zones=review.options?.panelZones||{};
  const previewZones=sourcePreviewZones(review);
  const visualZones={...previewZones,...zones};
  const mappedCount=Object.values(zones).filter(zone=>zone?.box).length;
  const samplePreview=Object.keys(previewZones).some(name=>!zones[name]?.box);
  const genericFullPagePreview=!review.sample&&samplePreview;
  let contextZone=null,selectedPanelFound=false;
  if(selected?.item.box){
    const [x0,y0,x1,y1]=selected.item.box,center=[(x0+x1)/2,(y0+y1)/2];
    const contextZones=genericFullPagePreview?zones:visualZones;
    contextZone=Object.entries(contextZones).find(([,zone])=>zone.page===selected.item.page&&zone.box&&center[0]>=zone.box[0]&&center[0]<=zone.box[2]&&center[1]>=zone.box[1]&&center[1]<=zone.box[3]);
    selectedPanelFound=Boolean(contextZone);
  }
  if(!contextZone){const contextZones=genericFullPagePreview?zones:visualZones;contextZone=Object.entries(contextZones).find(([name])=>name==='front')||Object.entries(contextZones)[0]||null;}
  let visual='';
  if(mode==='3d'){
    const targetAngles={front:0,right:-90,back:-180,left:90};
    const defaultAngle=selectedPanelFound&&contextZone?.[0] in targetAngles?targetAngles[contextZone[0]]:-28;
    const dims=foldedDimensions(review,genericFullPagePreview?zones:visualZones),angle=Number.isFinite(cartonRotation)?cartonRotation:defaultAngle,tilt=Number.isFinite(cartonTilt)?cartonTilt:-10;
    const faceClasses={front:'carton-front',back:'carton-back',left:'carton-left',right:'carton-right',top:'carton-top',bottom:'carton-bottom'};
    const faces=Object.entries(faceClasses).map(([name,css])=>{
      const zone=visualZones[name]?.box?{...visualZones[name],name}:null;
      const reviewerMapped=Boolean(zones[name]?.box);
      const faceState=reviewerMapped?'mapped':samplePreview&&zone?'preview-only':'unmapped';
      const isFindingFace=selectedPanelFound&&contextZone&&contextZone[0]===name;
      const facePreviewLabel=genericFullPagePreview&&name==='front'?' full-page illustration only':samplePreview&&zone?' visual sample preview':'';
      const evidenceBoxes=zone&&(!genericFullPagePreview||reviewerMapped)?faceEvidenceBoxes(review,zone,finding?.id,activeEvidenceIndex):'';
      return `<div class="carton-face ${css} ${faceState} ${isFindingFace?'face-focused':''}" data-carton-face="${name}" aria-label="${faceLabels[name]} panel${facePreviewLabel}">${zone?faceTexture(review,zone):`<span class="carton-unmapped">${esc(faceLabels[name])}<br>Artwork not mapped</span>`}${reviewerMapped?facePins(review,zone,finding?.id):''}${evidenceBoxes}</div>`;
    }).join('');

    const contextName=contextZone?(faceLabels[contextZone[0]]||contextZone[0]):'';
    const location=genericFullPagePreview?'Full artwork page · illustrative front only':samplePreview?(review.sample==='organizer'?'Organizer artwork · illustrative fold':'3D package preview · illustrative fold'):contextZone?`${selectedPanelFound?'Evidence on':'Mapped face'} ${contextName}`:'Artwork faces not mapped';
    const prompt=!mappedCount&&(!samplePreview||genericFullPagePreview)
      ?`<div class="carton-map-prompt"><div><b>Bring your artwork onto the package</b><span>${genericFullPagePreview?'Map the real package faces before treating this illustrative 3D fold as package-specific.':'Map the supplied front, back, and side panels to preview this carton.'}</span></div><button type="button" class="secondary" data-action="tab" data-tab="sources">Map faces →</button></div>`
      :'';
    const depthNote=mappedCount&&dims.measured?'Proportions follow your mapped faces.':'Carton proportions are illustrative.';
    const studioLabel=genericFullPagePreview?'Full artwork page · preview only':samplePreview?'Source artwork preview':`${mappedCount} mapped face${mappedCount===1?'':'s'}`;
    const caption=genericFullPagePreview?'The full supplied page is shown on an illustrative front; map real faces for package-specific artwork context.':samplePreview?'Source crops on an illustrative carton; the preview does not change review findings.':depthNote;
    visual=`<div class="carton-stage carton-studio ${mappedCount?'':'unmapped-preview'} ${samplePreview?'sample-artwork-preview':''}"><div class="carton-studio-head"><span><span class="studio-indicator" aria-hidden="true"></span>PACKAGE STUDIO</span><span>${studioLabel}</span></div><div class="carton-scene" data-carton-scene data-angle="${angle}" data-tilt="${tilt}" data-carton-width="${dims.width}" data-carton-height="${dims.height}" data-carton-depth="${dims.depth}" tabindex="0" role="group" aria-label="Interactive carton. Drag to rotate, or use arrow keys. Home resets the view."><div class="carton-studio-floor" aria-hidden="true"></div><div class="carton-orbit"><div class="carton-model" data-carton-model style="--carton-w:${dims.width}px;--carton-h:${dims.height}px;--carton-d:${dims.depth}px;transform:rotateX(${tilt}deg) rotateY(${angle}deg)">${faces}</div></div><span class="carton-drag-hint">Drag to explore <span aria-hidden="true">·</span> Arrow keys rotate</span></div>${prompt}<div class="carton-face-nav" role="group" aria-label="View package face">${['front','right','back','left'].map(name=>`<button type="button" data-carton-view="${name}" aria-pressed="false">${esc(faceLabels[name])}</button>`).join('')}</div><div class="carton-controls"><button type="button" class="carton-turntable" data-carton-play aria-pressed="false" aria-label="Play package turntable"><span data-carton-play-icon aria-hidden="true">▶</span><span data-carton-play-label>Turntable</span></button><label class="carton-rotate"><span class="sr-only">Rotate package</span><input type="range" data-carton-rotation min="-180" max="180" step="1" value="${angle}" aria-label="Rotate illustrative carton"><output>${Math.round(angle)}°</output></label><button type="button" class="textbutton" data-carton-reset>Reset</button></div><p class="carton-location" aria-live="polite">${esc(location)}${selectedPanelFound&&finding?.title?` · ${esc(finding.title)}`:''}</p>${(mappedCount||samplePreview)?'<div class="carton-pin-legend"><span class="issue">! Issue</span><span class="review">? Review</span><span class="match">✓ Match</span></div>':''}<p class="carton-caption">${caption} Use 2D proof for exact artwork inspection.</p></div>`;
  }else{
    const regions=artworkEvidence.filter(({item})=>item.page===page.number&&Array.isArray(item.box));
    const issue=finding?.status==='issue';
    const selectedBox=selected?.item.page===page.number?selected.item.box:null;
    const diffLeft=selectedBox?(selectedBox[2]<.58?Math.min(54,selectedBox[2]*100+1):Math.max(2,selectedBox[0]*100-38)):0;
    const pageZones=Object.entries(zones).filter(([,zone])=>zone.page===page.number&&zone.box);
    const imageUnit=page.unit==='pt'||(!page.unit&&/\.pdf$/i.test(doc.name||''))?'pt':'px';
    const hash=doc.sha256||'';
    visual=`<div class="proof-surface-label"><span><i></i> ORIGINAL ARTWORK</span><span>Page ${page.number} / ${doc.pages.length}</span></div>
    <div class="workbench-art-frame ${showBoxes?'':'hide-boxes'} ${showZones?'':'hide-zones'}" tabindex="0" role="group" aria-label="Artwork canvas. Drag or use arrow keys to pan when zoomed. Plus and minus zoom. Home fits the page." data-workbench-frame data-zoom="${Math.max(100,Math.min(400,Number(zoom)||100))}" data-unit="${imageUnit}" data-page-width="${Number(page.width)||0}" data-page-height="${Number(page.height)||0}" ${selectedBox?`data-focus-box="${selectedBox.join(',')}"`:''}>
      <div class="workbench-art-content" data-workbench-image><img src="${image(review,page)}" draggable="false" alt="Original artwork page ${page.number}">
      ${pageZones.map(([name,zone])=>`<div class="workbench-zone-overlay ${esc(name)}" style="left:${zone.box[0]*100}%;top:${zone.box[1]*100}%;width:${(zone.box[2]-zone.box[0])*100}%;height:${(zone.box[3]-zone.box[1])*100}%"><span>${esc(faceLabels[name]||name)} panel zone</span></div>`).join('')}
      ${regions.map(({item,index})=>`<button type="button" class="workbench-region ${finding.status} ${index===activeEvidenceIndex?'selected':''}" data-action="select-evidence" data-index="${index}" style="left:${item.box[0]*100}%;top:${item.box[1]*100}%;width:${(item.box[2]-item.box[0])*100}%;height:${(item.box[3]-item.box[1])*100}%" aria-label="Inspect ${esc(item.quote||finding.title)}"><span>${index===activeEvidenceIndex?'Selected':'Evidence'}</span></button>`).join('')}
      ${issue&&selectedBox?`<div class="workbench-diff-card" style="left:${diffLeft}%;top:${Math.min(68,selectedBox[1]*100)}%"><div class="workbench-diff-actual"><small>ARTWORK SAYS</small><b title="${esc(selected.item.quote||finding.observed||'Not detected')}">${esc(compactText(selected.item.quote||finding.observed||'Not detected'))}</b></div><span class="workbench-diff-arrow">→</span><div class="workbench-diff-reference"><small>SUPPLIED SOURCE</small><b title="${esc(finding.expected||'Not specified')}">${esc(compactText(finding.expected||'Not specified'))}</b></div></div>`:''}
      </div><span class="artwork-gesture-hint">Drag to pan · pinch to zoom · double-click to fit</span>
    </div>
    ${viewportToolbar({zoom:Number(zoom)||100,hasFocus:Boolean(selectedBox)})}
    <div class="prepress-hud"><label class="hud-layer"><input type="checkbox" data-layer-boxes ${showBoxes?'checked':''}> Evidence boxes</label><label class="hud-layer" title="Reviewer-drawn regions"><input type="checkbox" data-layer-zones ${showZones?'checked':''}> Panel zones</label><span class="hud-coordinate" data-cursor-coordinate>X — · Y —</span><span class="hud-hash" data-source-hash data-hash="${esc(hash)}" data-document-id="${esc(doc.id)}">${hash?'Checking SHA-256…':'Source hash unavailable'}</span></div><p class="workbench-art-caption">The 2D proof is unaltered. Drag, scroll, or use the arrows to explore at any zoom.</p>`;
  }
  return `<section class="workbench-artwork" aria-label="Artwork review surface"><div class="workbench-viewer-head"><div class="segmented-control" role="group" aria-label="Artwork view"><button class="${mode==='2d'?'active':''}" data-action="workbench-mode" data-mode="2d" aria-pressed="${mode==='2d'}">2D proof</button><button class="${mode==='3d'?'active':''}" data-action="workbench-mode" data-mode="3d" aria-pressed="${mode==='3d'}">3D context</button></div>${mode==='2d'?`<label class="workbench-page-select">Artwork page<select data-workbench-page>${pageOptions.map(n=>`<option value="${n}" ${n===page.number?'selected':''}>Page ${n}</option>`).join('')}</select></label>`:`<span class="workbench-page-select">${genericFullPagePreview?`Illustrative front · ${mappedCount} face${mappedCount===1?'':'s'} mapped`:review.sample==='organizer'&&!mappedCount?'Visual sample · 0 geometry maps':mappedCount?`Mapped faces: ${mappedCount}`:samplePreview?'Auto 3D layout':'Artwork faces not mapped'}</span>`}</div>${visual}</section>`;
}
export function revisionVisual(current,previous){
  const a=artwork(previous),b=artwork(current);if(!a||!b)return '';
  const page=(doc,n)=>doc.pages.find(p=>p.number===n)||doc.pages[0];const old=page(a,1),now=page(b,1);
  return `<section class="revision-visual panel" data-revision-visual><div class="eyebrow">ARTWORK VERSION VIEW</div><h3>Compare source artwork side by side</h3><p class="subtle">These are the original rendered files. Scrolling is synchronized for visual inspection; the status table below remains the record of supported check changes.</p><div class="revision-grid"><article><h4>Previous version</h4><div class="revision-scroll"><img src="${image(previous,old)}" alt="Previous artwork page 1"></div></article><article><h4>Revised version</h4><div class="revision-scroll"><img src="${image(current,now)}" alt="Revised artwork page 1"></div></article></div></section>`;
}
const sourceHashChecks=new Map();
function hashHex(buffer){return [...new Uint8Array(buffer)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
function verifyDisplayedSource(container,review){
  const badge=container.querySelector('[data-source-hash]');if(!badge)return;
  const expected=badge.dataset.hash,documentId=badge.dataset.documentId;
  if(!expected||!documentId||!globalThis.crypto?.subtle){badge.textContent='Source hash verification unavailable';badge.dataset.state='unavailable';return;}
  const key=`${review.id}:${documentId}:${expected}`;
  if(!sourceHashChecks.has(key))sourceHashChecks.set(key,(async()=>{
    const response=await fetch(`/api/reviews/${encodeURIComponent(review.id)}/files/${encodeURIComponent(documentId)}`);
    if(!response.ok)throw new Error('Source file could not be read for hash verification.');
    const digest=hashHex(await crypto.subtle.digest('SHA-256',await response.arrayBuffer()));
    return digest.toLowerCase()===expected.toLowerCase();
  })().catch(error=>({error:error.message})));
  sourceHashChecks.get(key).then(result=>{
    if(!badge.isConnected)return;
    if(result?.error){badge.textContent='Source hash could not be rechecked';badge.dataset.state='unavailable';return;}
    badge.textContent=result?`SHA-256 verified · ${expected.slice(0,12)}…`:'SHA-256 mismatch · inspect source';
    badge.dataset.state=result?'verified':'mismatch';
  });
}
function mountSpotlight(container){
  const frame=container.querySelector('[data-proof-spotlight]');if(!frame)return;
  const controls=frame.closest('.visual-diff'),focus=frame.dataset.focusBox?.split(',').map(Number);
  mountViewport({frame,content:frame.querySelector('[data-proof-spotlight-content]'),controls,slider:controls.querySelector('[data-proof-zoom]'),focus});
}
function mountTraceConnector(container){
  const grid=container.querySelector('[data-proof-grid]');if(!grid||grid.dataset.connectorMounted)return;grid.dataset.connectorMounted='true';
  const svg=grid.querySelector('[data-proof-connector]'),path=svg?.querySelector('path'),startCircle=svg?.querySelector('[data-trace-start]'),endCircle=svg?.querySelector('[data-trace-end]');
  const update=()=>{
    const source=grid.querySelector('[data-trace-source]')||grid.querySelector('[data-trace-rule]'),target=grid.querySelector('[data-trace-target]');if(!svg||!path||!source||!target)return;
    const base=grid.getBoundingClientRect(),a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
    if(!base.width||!base.height)return;
    svg.setAttribute('viewBox',`0 0 ${base.width} ${base.height}`);svg.setAttribute('width',String(base.width));svg.setAttribute('height',String(base.height));
    const x1=a.right-base.left,y1=a.top+a.height/2-base.top,x2=b.left+b.width/2-base.left,y2=b.top+b.height/2-base.top;
    const bend=Math.max(24,Math.abs(x2-x1)*.38);path.setAttribute('d',`M ${x1} ${y1} C ${x1+bend} ${y1}, ${x2-bend} ${y2}, ${x2} ${y2}`);
    for(const [node,x,y] of [[startCircle,x1,y1],[endCircle,x2,y2]]){node?.setAttribute('cx',String(x));node?.setAttribute('cy',String(y));}
    svg.hidden=false;
  };
  requestAnimationFrame(update);
  const observer=globalThis.ResizeObserver?new ResizeObserver(update):null;observer?.observe(grid);
  container.querySelectorAll('[data-trace-source],[data-trace-target]').forEach(node=>observer?.observe(node));
  const clean=()=>{observer?.disconnect();window.removeEventListener('resize',update);};
  window.addEventListener('resize',update);container.closest('dialog')?.addEventListener('close',clean,{once:true});
  container.querySelector('[data-proof-spotlight]')?.addEventListener('viewportchange',()=>requestAnimationFrame(update));
}
// The proof dialog also mounts artwork controls. It must not dispose a live
// carton belonging to the review underneath it.
let cartonInteraction=null;
function mountCartonDrag(container,onRotation){
  const scene=container.querySelector('[data-carton-scene]'),model=scene?.querySelector('[data-carton-model]');
  if(cartonInteraction&&(!cartonInteraction.scene.isConnected||(cartonInteraction.container===container&&cartonInteraction.scene!==scene)))cartonInteraction.cleanup();
  if(!scene||!model||cartonInteraction?.scene===scene)return;
  cartonInteraction?.cleanup();scene.dataset.dragMounted='true';
  const stage=scene.closest('.carton-stage'),slider=stage?.querySelector('[data-carton-rotation]'),output=slider?.parentElement?.querySelector('output'),play=stage?.querySelector('[data-carton-play]');
  const viewButtons=stage?[...stage.querySelectorAll('[data-carton-view]')]:[];
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const wrap=value=>((value+180)%360+360)%360-180;
  const faceAngles={front:0,right:-90,back:-180,left:90};
  const initialAngle=Number(scene.dataset.angle),initialTilt=Number(scene.dataset.tilt);
  let angle=Number.isFinite(initialAngle)?initialAngle:-28,tilt=Number.isFinite(initialTilt)?initialTilt:-10;
  let drag=null,pendingDrag=null,tween=null,frame=0,lastTime=null,playing=false,disposed=false,lastControlsTime=-Infinity;
  const listeners=[];
  const listen=(node,type,handler)=>{if(!node?.addEventListener)return;node.addEventListener(type,handler);listeners.push(()=>node.removeEventListener(type,handler));};
  // One animation clock owns the pose, including face shortcuts. Starting a
  // drag during a shortcut therefore continues from the actual visible pose.
  model.style.transition='none';
  const syncControls=()=>{
    const displayAngle=Math.round(wrap(angle));
    scene.dataset.angle=String(wrap(angle));scene.dataset.tilt=String(tilt);
    if(slider&&document.activeElement!==slider&&slider.value!==String(displayAngle))slider.value=String(displayAngle);
    if(output&&output.textContent!==`${displayAngle}°`)output.textContent=`${displayAngle}°`;
    for(const button of viewButtons){
      const active=String(Math.abs(wrap(angle-faceAngles[button.dataset.cartonView]))<8);
      if(button.getAttribute('aria-pressed')!==active)button.setAttribute('aria-pressed',active);
    }
  };
  const rotate=(nextAngle,nextTilt,{sync=false,time=0}={})=>{
    // Keep the angle bounded during continuous playback so long sessions do
    // not feed huge rotation values into the browser's 3D transform matrix.
    angle=wrap(nextAngle);tilt=nextTilt;
    model.style.transform=`rotateX(${tilt}deg) rotateY(${angle}deg)`;
    // Keep the rotating layer independent of range/text layout work. Controls
    // still catch up immediately when interaction or playback ends.
    if(sync||time-lastControlsTime>=100){syncControls();lastControlsTime=time;}
    onRotation?.(wrap(angle),tilt);
  };
  const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(tick);};
  const setPlaying=value=>{
    playing=Boolean(value)&&!reduced?.matches&&!document.hidden&&!disposed;tween=null;
    stage?.classList.toggle('is-playing',playing);
    play?.setAttribute('aria-pressed',String(playing));play?.setAttribute('aria-label',playing?'Pause package turntable':'Play package turntable');
    const icon=play?.querySelector('[data-carton-play-icon]'),text=play?.querySelector('[data-carton-play-label]');if(icon)icon.textContent=playing?'Ⅱ':'▶';if(text)text.textContent=playing?'Pause':'Turntable';
    cancelAnimationFrame(frame);frame=0;lastTime=null;syncControls();
    if(playing||pendingDrag)schedule();
  };
  function tick(time){
    frame=0;
    if(disposed||!scene.isConnected){cleanup();return;}
    if(pendingDrag){const pose=pendingDrag;pendingDrag=null;rotate(pose.angle,pose.tilt,{time});}
    else if(playing){
      const elapsed=lastTime===null?0:Math.max(0,time-lastTime);lastTime=time;
      rotate(angle+elapsed*.032,tilt,{time});
    }else if(tween){
      if(tween.start===null)tween.start=time;
      const progress=Math.min(1,Math.max(0,(time-tween.start)/240)),eased=1-Math.pow(1-progress,3);
      rotate(tween.angle+(tween.targetAngle-tween.angle)*eased,tween.tilt+(tween.targetTilt-tween.tilt)*eased,{time,sync:progress===1});
      if(progress===1)tween=null;
    }
    if(playing||tween||pendingDrag)schedule();
  }
  const moveTo=(nextAngle,nextTilt)=>{
    setPlaying(false);
    if(reduced?.matches){rotate(nextAngle,nextTilt,{sync:true});return;}
    tween={angle,tilt,targetAngle:nextAngle,targetTilt:nextTilt,start:null};schedule();
  };
  const fit=()=>{
    const width=Number(scene.dataset.cartonWidth)||214,height=Number(scene.dataset.cartonHeight)||282,depth=Number(scene.dataset.cartonDepth)||64;
    const availableWidth=Math.max(100,scene.clientWidth-58),availableHeight=Math.max(100,scene.clientHeight-75);
    const scale=Math.min(1.3,availableWidth/(Math.hypot(width,depth)+20),availableHeight/(Math.hypot(width,height,depth)+20));
    scene.style.setProperty('--carton-fit',String(Math.max(.35,scale)));
  };
  const onMove=event=>{
    if(!drag||(event.pointerId!==undefined&&event.pointerId!==drag.pointerId))return;
    pendingDrag={angle:drag.angle+(event.clientX-drag.x)*.5,tilt:Math.max(-65,Math.min(65,drag.tilt-(event.clientY-drag.y)*.35))};schedule();
  };
  const stop=event=>{
    if(event?.pointerId!==undefined&&drag&&event.pointerId!==drag.pointerId)return;
    const pointerId=drag?.pointerId;drag=null;
    if(pendingDrag){const pose=pendingDrag;pendingDrag=null;rotate(pose.angle,pose.tilt,{sync:true});}
    if(!playing&&!tween){cancelAnimationFrame(frame);frame=0;}
    scene.classList.remove('dragging');
    // Clear the drag before releasing capture: lostpointercapture can fire
    // synchronously and must not attempt to release it a second time.
    try{if(pointerId!==undefined&&scene.hasPointerCapture?.(pointerId))scene.releasePointerCapture(pointerId);}catch{}
    window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);
    syncControls();
  };
  const reset=()=>moveTo(angle+wrap(-28-angle),-10);
  listen(scene,'pointerdown',event=>{
    if(drag||event.button!==0||event.isPrimary===false||event.target.closest('button,a,input'))return;
    setPlaying(false);drag={x:event.clientX,y:event.clientY,angle,tilt,pointerId:event.pointerId};scene.classList.add('dragging');
    try{scene.setPointerCapture?.(event.pointerId);}catch{}
    // Captured pointer events already arrive at the scene. Only use window
    // movement as a fallback, avoiding duplicate work for bubbled events.
    if(!scene.hasPointerCapture?.(event.pointerId))window.addEventListener('pointermove',onMove);
    window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);
    scene.focus({preventScroll:true});event.preventDefault();
  });
  listen(scene,'pointermove',onMove);listen(scene,'pointerup',stop);listen(scene,'pointercancel',stop);listen(scene,'lostpointercapture',stop);
  listen(scene,'keydown',event=>{
    if(event.target!==scene)return;
    const step=event.shiftKey?30:10;
    if(event.key==='Home'){event.preventDefault();reset();return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();moveTo(angle+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),Math.max(-65,Math.min(65,tilt+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0))));
  });
  listen(slider,'input',event=>{event.stopPropagation();setPlaying(false);rotate(angle+wrap(Number(slider.value)-angle),tilt,{sync:true});});
  // Preserve the live pose and avoid the document handler rebuilding the whole review.
  listen(slider,'change',event=>event.stopPropagation());
  for(const button of viewButtons)listen(button,'click',()=>{
    const faceName=button.dataset.cartonView;
    moveTo(angle+wrap(faceAngles[faceName]-angle),-8);
    for(const face of scene.querySelectorAll('[data-carton-face]'))face.classList.toggle('face-focused',face.dataset.cartonFace===faceName);
    const locationEl=stage?.querySelector('.carton-location');
    if(locationEl)locationEl.textContent=({front:'Front',back:'Back',left:'Left side',right:'Right side'}[faceName]||faceName)+' face';
  });
  listen(stage?.querySelector('[data-carton-reset]'),'click',reset);
  listen(play,'click',()=>setPlaying(!playing));
  listen(document,'visibilitychange',()=>{if(document.hidden){stop();setPlaying(false);}});
  listen(window,'blur',()=>{stop();setPlaying(false);});
  const motion=()=>{if(reduced?.matches)setPlaying(false);if(play){play.disabled=Boolean(reduced?.matches);play.title=reduced?.matches?'Turntable motion is disabled by your reduced motion preference':'';}};
  listen(reduced,'change',motion);
  const observer=globalThis.ResizeObserver?new ResizeObserver(fit):null;observer?.observe(scene);listen(window,'resize',fit);
  function cleanup(){
    if(disposed)return;disposed=true;
    stop();cancelAnimationFrame(frame);frame=0;observer?.disconnect();for(const remove of listeners)remove();delete scene.dataset.dragMounted;
    if(cartonInteraction?.scene===scene)cartonInteraction=null;
  }
  cartonInteraction={scene,container,cleanup};fit();motion();rotate(angle,tilt,{sync:true});
}
export function mountArtworkControls(container,{review,onRotation,viewport,onViewport}={}){
  if(!container)return;
  if(!container.dataset.artMounted){container.dataset.artMounted='true';
    container.addEventListener('change',event=>{const input=event.target.closest('[data-art-page]');if(!input)return;const wrapper=input.closest('[data-artwork-map]');if(!wrapper)return;const next=document.createElement('div');next.innerHTML=artworkMap(review,{page:Number(input.value)});wrapper.replaceWith(next.firstElementChild);mountArtworkControls(container,{review,onRotation,viewport,onViewport});});
    const scrolls=[...container.querySelectorAll('.revision-scroll')];for(const scroll of scrolls)scroll.addEventListener('scroll',()=>{if(scroll.dataset.syncing)return;for(const other of scrolls)if(other!==scroll){other.dataset.syncing='1';other.scrollTop=scroll.scrollTop;other.scrollLeft=scroll.scrollLeft;delete other.dataset.syncing;}},{passive:true});
  }
  const frame=container.querySelector('[data-workbench-frame]');
  if(frame&&!frame.dataset.mounted){
    frame.dataset.mounted='true';
    const coordinate=container.querySelector('[data-cursor-coordinate]');
    const controls=frame.closest('.workbench-artwork');
    mountViewport({
      frame,content:frame.querySelector('[data-workbench-image]'),controls,
      slider:controls.querySelector('[data-workbench-zoom]'),
      initialView:viewport||{scale:Number(frame.dataset.zoom)/100||1,x:0,y:0},
      focus:frame.dataset.focusBox?frame.dataset.focusBox.split(',').map(Number):null,
      onChange:onViewport,
      onPoint:({x,y})=>{
        if(!coordinate)return;
        if(frame.dataset.unit==='pt')coordinate.textContent=`X ${(x*Number(frame.dataset.pageWidth)*25.4/72).toFixed(1)} mm · Y ${(y*Number(frame.dataset.pageHeight)*25.4/72).toFixed(1)} mm`;
        else coordinate.textContent=`X ${(x*100).toFixed(1)}% · Y ${(y*100).toFixed(1)}%`;
      },
    });
    controls.querySelector('[data-layer-boxes]')?.addEventListener('change',event=>frame.classList.toggle('hide-boxes',!event.target.checked));
    controls.querySelector('[data-layer-zones]')?.addEventListener('change',event=>frame.classList.toggle('hide-zones',!event.target.checked));
    frame.addEventListener('pointerleave',()=>{if(coordinate)coordinate.textContent='X — · Y —';});
    verifyDisplayedSource(container,review);
  }
  mountSpotlight(container);mountTraceConnector(container);mountCartonDrag(container,onRotation);
}
