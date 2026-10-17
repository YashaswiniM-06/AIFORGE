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
export function findingVisual(review,finding){
  const doc=artwork(review),proof=finding.evidence?.find(e=>e.role==='artwork'&&e.page&&Array.isArray(e.box));if(!doc||!proof)return `<section class="visual-diff unavailable"><h3>Visual comparison</h3><p class="subtle">No precise artwork location was extracted for this finding. The source and observed values below remain the evidence to inspect.</p></section>`;
  const page=doc.pages.find(p=>p.number===proof.page);if(!page)return '';
  const [x0,y0,x1,y1]=proof.box;const different=finding.status==='issue';
  const zoom=Math.min(3.2,Math.max(1.5,Math.min(.82/Math.max(.02,x1-x0),.62/Math.max(.02,y1-y0))));
  const tx=50-((x0+x1)/2)*zoom*100,ty=50-((y0+y1)/2)*zoom*100;
  return `<section class="visual-diff"><div><div class="eyebrow">VISUAL COPY COMPARISON</div><h3>${different?'Observed copy and supplied reference':'Located artwork evidence'}</h3><p class="subtle">The artwork is unchanged. The green label is supplied reference text for inspection, not an approved replacement.</p></div><div class="proof-spotlight-toolbar"><span>Evidence spotlight</span><label>Zoom <input type="range" min="100" max="400" step="10" value="${Math.round(zoom*100)}" data-proof-zoom aria-label="Artwork spotlight zoom"><output>${Math.round(zoom*100)}%</output></label><button type="button" class="textbutton" data-proof-reset>Reset</button></div><div class="proof-spotlight-frame diff-stage" style="--page-ratio:${Number(page.width)/Math.max(1,Number(page.height))}" data-proof-spotlight data-center-x="${(x0+x1)/2}" data-center-y="${(y0+y1)/2}" data-zoom="${zoom}" data-initial-zoom="${zoom}"><div class="proof-spotlight-content" data-proof-spotlight-content style="transform:translate(${tx}%,${ty}%) scale(${zoom})"><img src="${image(review,page)}" alt="Artwork page ${page.number}"><div class="spotlight-highlight" data-trace-target style="left:${x0*100}%;top:${y0*100}%;width:${(x1-x0)*100}%;height:${(y1-y0)*100}%"><span>OBSERVED ARTWORK</span></div>${different?`<div class="diff-reference" style="left:${Math.min(72,x1*100+2)}%;top:${Math.min(82,y0*100)}%"><small>REFERENCE COPY</small><b>${esc(finding.expected)}</b></div>`:''}</div></div><div class="diff-values"><div class="observed"><small>Observed artwork text</small><p>${esc(finding.observed||'Not detected')}</p></div><div class="reference"><small>Supplied reference</small><p>${esc(finding.expected||'No value')}</p></div></div></section>`;
}
const faceLabels={front:'Front',back:'Back',left:'Left side',right:'Right side',top:'Top',bottom:'Bottom'};
const findingSymbols={issue:'!',review:'?',unable:'—',match:'✓'};
const compactText=(value,limit=52)=>{const text=String(value??'').replace(/\s+/g,' ').trim();return text.length>limit?`${text.slice(0,limit-1).trimEnd()}…`:text;};
// These regions are used only to make the organizer's supplied dieline legible as a visual mockup.
// They are never persisted as panel mappings and never participate in rule geometry or findings.
const organizerVisualZones={
  // Crop inside the principal lower-row panels. The dieline has a logo flap
  // immediately above them and colored cut/crease margins around them; including
  // those edges made the folded preview look like a chopped-up sheet.
  back:{page:1,box:[.04,.37,.33,.685]},
  left:{page:1,box:[.346,.37,.514,.685]},
  front:{page:1,box:[.528,.37,.82,.685]},
  right:{page:1,box:[.834,.37,.993,.685]},
};
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
  let contextZone=null,selectedPanelFound=false;
  if(selected?.item.box){
    const [x0,y0,x1,y1]=selected.item.box,center=[(x0+x1)/2,(y0+y1)/2];
    contextZone=Object.entries(zones).find(([,zone])=>zone.page===selected.item.page&&zone.box&&center[0]>=zone.box[0]&&center[0]<=zone.box[2]&&center[1]>=zone.box[1]&&center[1]<=zone.box[3]);
    selectedPanelFound=Boolean(contextZone);
  }
  if(!contextZone)contextZone=Object.entries(zones).find(([name])=>name==='front')||Object.entries(zones)[0]||null;
  let visual='';
  if(mode==='3d'){
    const mappedCount=Object.values(zones).filter(zone=>zone?.box).length;
    const samplePreview=review.sample==='organizer'&&mappedCount===0;
    const visualZones=samplePreview?organizerVisualZones:zones;
    const dims=samplePreview?{width:198,height:260,depth:58,measured:false}:foldedDimensions(review,visualZones),angle=Number.isFinite(cartonRotation)?cartonRotation:-22,tilt=Number.isFinite(cartonTilt)?cartonTilt:-7;
    const faceClasses={front:'carton-front',back:'carton-back',left:'carton-left',right:'carton-right',top:'carton-top',bottom:'carton-bottom'};
    const faces=Object.entries(faceClasses).map(([name,css])=>{
      const zone=visualZones[name]?.box?{...visualZones[name],name}:null;
      const reviewerMapped=Boolean(zones[name]?.box);
      const faceState=reviewerMapped?'mapped':samplePreview&&zone?'preview-only':'unmapped';
      return `<div class="carton-face ${css} ${faceState}" data-carton-face="${name}" aria-label="${faceLabels[name]} panel${samplePreview&&zone?' visual sample preview':''}">${zone?faceTexture(review,zone):`<span class="carton-unmapped">${esc(faceLabels[name])}<br>map artwork</span>`}${reviewerMapped?facePins(review,zone,finding?.id):''}</div>`;
    }).join('');
    const contextName=contextZone?(faceLabels[contextZone[0]]||contextZone[0]):'';
    const location=samplePreview?'ILLUSTRATIVE SAMPLE PREVIEW · FACE MAPPING NOT SAVED':contextZone?`${selectedPanelFound?'LOCATED ON':'LOCATION NOT MAPPED'} · ${contextName.toUpperCase()}`:'NO ARTWORK PANELS MAPPED';
    const prompt=!mappedCount
      ?`<div class="carton-map-prompt ${samplePreview?'sample-preview-note':''}"><div><b>${samplePreview?'Organizer artwork visual preview':'Map artwork faces'}</b><span>${samplePreview?'Visible crops are for visual context only; draw face zones to enable checklist geometry checks.':'Map front, back, or side panels to place supplied artwork on the carton.'}</span></div><button type="button" class="secondary" data-action="tab" data-tab="sources">Map faces →</button></div>`
      :'';
    const depthNote=mappedCount&&dims.measured?'Side depth follows the reviewer-drawn side panel.':'Side depth is estimated until a side panel is mapped.';
    visual=`<div class="carton-stage ${mappedCount?'':'unmapped-preview'} ${samplePreview?'sample-artwork-preview':''}"><div class="carton-scene" data-carton-scene aria-label="Drag to rotate the carton. Select a mapped finding pin to inspect evidence."><div class="carton-orbit"><div class="carton-model" data-carton-model style="--carton-w:${dims.width}px;--carton-h:${dims.height}px;--carton-d:${dims.depth}px;--carton-angle:${angle}deg;--carton-tilt:${tilt}deg;transform:rotateX(${tilt}deg) rotateY(${angle}deg)">${faces}</div></div><span class="carton-drag-hint">Drag to rotate · use the slider for a precise angle</span></div>${prompt}<p class="carton-location">${location}${selectedPanelFound&&finding?.title?` · ${esc(finding.title)}`:''}</p><div class="carton-controls"><label class="carton-rotate">Rotate <input type="range" data-carton-rotation min="-180" max="180" step="1" value="${angle}" aria-label="Rotate illustrative carton"><output>${angle}°</output></label><button type="button" class="textbutton" data-carton-reset>Reset view</button></div>${mappedCount?'<div class="carton-pin-legend"><span class="issue">! Issue</span><span class="review">? Human review</span><span class="match">✓ Match</span><span class="unable">— Unable</span></div>':''}<p class="carton-caption">${samplePreview?'Visual-only crops from the supplied organizer dieline; not saved panel geometry and not used to calculate findings.':`Illustrative 3D context. ${depthNote} No artwork texture is inferred for unmapped faces.`} The source PDF stays unchanged. Cut, crease, and glue geometry are not inferred. Use 2D proof for exact inspection.</p></div>`;
  }else{
    const regions=artworkEvidence.filter(({item})=>item.page===page.number&&Array.isArray(item.box));
    const issue=finding?.status==='issue';
    const selectedBox=selected?.item.page===page.number?selected.item.box:null;
    const diffLeft=selectedBox?(selectedBox[2]<.58?Math.min(54,selectedBox[2]*100+1):Math.max(2,selectedBox[0]*100-38)):0;
    const pageZones=Object.entries(zones).filter(([,zone])=>zone.page===page.number&&zone.box);
    const imageUnit=page.unit==='pt'||(!page.unit&&/\.pdf$/i.test(doc.name||''))?'pt':'px';
    const hash=doc.sha256||'';
    visual=`<div class="workbench-art-frame ${showBoxes?'':'hide-boxes'} ${showZones?'':'hide-zones'}" data-workbench-frame data-zoom="${Math.max(100,Math.min(300,Number(zoom)||100))}" data-unit="${imageUnit}" data-page-width="${Number(page.width)||0}" data-page-height="${Number(page.height)||0}" style="aspect-ratio:${page.width||1200}/${page.height||860}"><div class="workbench-art-content" data-workbench-image><img src="${image(review,page)}" alt="Original artwork page ${page.number}">${pageZones.map(([name,zone])=>`<div class="workbench-zone-overlay ${esc(name)}" style="left:${zone.box[0]*100}%;top:${zone.box[1]*100}%;width:${(zone.box[2]-zone.box[0])*100}%;height:${(zone.box[3]-zone.box[1])*100}%"><span>${esc(faceLabels[name]||name)} panel zone</span></div>`).join('')}${regions.map(({item,index})=>`<button type="button" class="workbench-region ${finding.status} ${index===activeEvidenceIndex?'selected':''}" data-action="select-evidence" data-index="${index}" style="left:${item.box[0]*100}%;top:${item.box[1]*100}%;width:${(item.box[2]-item.box[0])*100}%;height:${(item.box[3]-item.box[1])*100}%" aria-label="Inspect ${esc(item.quote||finding.title)}"><span>${index===activeEvidenceIndex?'Selected':'Evidence'}</span></button>`).join('')}${issue&&selectedBox?`<div class="workbench-diff-card" style="left:${diffLeft}%;top:${Math.min(68,selectedBox[1]*100)}%"><div class="workbench-diff-actual"><small>ARTWORK SAYS</small><b title="${esc(selected.item.quote||finding.observed||'Not detected')}">${esc(compactText(selected.item.quote||finding.observed||'Not detected'))}</b></div><span class="workbench-diff-arrow">→</span><div class="workbench-diff-reference"><small>SUPPLIED SOURCE</small><b title="${esc(finding.expected||'Not specified')}">${esc(compactText(finding.expected||'Not specified'))}</b></div></div>`:''}</div></div><div class="prepress-hud"><label class="hud-zoom">Zoom <input type="range" min="100" max="300" step="10" value="${Math.max(100,Math.min(300,Number(zoom)||100))}" data-workbench-zoom aria-label="Artwork zoom"><output>${Math.max(100,Math.min(300,Number(zoom)||100))}%</output></label><label class="hud-layer"><input type="checkbox" data-layer-boxes ${showBoxes?'checked':''}> Evidence boxes</label><label class="hud-layer" title="Reviewer-drawn regions, not automatically detected cut or crease lines"><input type="checkbox" data-layer-zones ${showZones?'checked':''}> Panel zones</label><span class="hud-coordinate" data-cursor-coordinate> X — · Y — </span><span class="hud-hash" data-source-hash data-hash="${esc(hash)}" data-document-id="${esc(doc.id)}">${hash?'Checking SHA-256…':'Source hash unavailable'}</span></div><p class="workbench-art-caption">Original supplied artwork · Page ${page.number} · The 2D proof is unaltered; toggle reviewer-drawn zones only when needed.</p>`;
  }
  return `<section class="workbench-artwork" aria-label="Artwork review surface"><div class="workbench-viewer-head"><div class="segmented-control" role="group" aria-label="Artwork view"><button class="${mode==='2d'?'active':''}" data-action="workbench-mode" data-mode="2d" aria-pressed="${mode==='2d'}">2D proof</button><button class="${mode==='3d'?'active':''}" data-action="workbench-mode" data-mode="3d" aria-pressed="${mode==='3d'}">3D context</button></div>${mode==='2d'?`<label class="workbench-page-select">Artwork page<select data-workbench-page>${pageOptions.map(n=>`<option value="${n}" ${n===page.number?'selected':''}>Page ${n}</option>`).join('')}</select></label>`:`<span class="workbench-page-select">${review.sample==='organizer'&&!Object.values(zones).some(zone=>zone?.box)?'Visual sample · 0 geometry maps':`Mapped faces: ${Object.values(zones).filter(zone=>zone.box).length}`}</span>`}</div>${visual}</section>`;
}
export function revisionVisual(current,previous){
  const a=artwork(previous),b=artwork(current);if(!a||!b)return '';
  const page=(doc,n)=>doc.pages.find(p=>p.number===n)||doc.pages[0];const old=page(a,1),now=page(b,1);
  return `<section class="revision-visual panel" data-revision-visual><div class="eyebrow">ARTWORK VERSION VIEW</div><h3>Compare source artwork side by side</h3><p class="subtle">These are the original rendered files. Scrolling is synchronized for visual inspection; the status table below remains the record of supported check changes.</p><div class="revision-grid"><article><h4>Previous version</h4><div class="revision-scroll"><img src="${image(previous,old)}" alt="Previous artwork page 1"></div></article><article><h4>Revised version</h4><div class="revision-scroll"><img src="${image(current,now)}" alt="Revised artwork page 1"></div></article></div></section>`;
}
const sourceHashChecks=new Map();
function hashHex(buffer){return [...new Uint8Array(buffer)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
function applySpotlight(frame,scale){
  const content=frame?.querySelector('[data-proof-spotlight-content]');if(!frame||!content)return;
  const x=Number(frame.dataset.centerX)||.5,y=Number(frame.dataset.centerY)||.5;
  const tx=50-x*scale*100,ty=50-y*scale*100;
  content.style.transform=`translate(${tx}%,${ty}%) scale(${scale})`;
  frame.dataset.zoom=String(scale);
  const output=frame.parentElement.querySelector('[data-proof-zoom]')?.parentElement.querySelector('output');if(output)output.textContent=`${Math.round(scale*100)}%`;
}
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
  const frame=container.querySelector('[data-proof-spotlight]');if(!frame||frame.dataset.mounted)return;frame.dataset.mounted='true';
  const slider=container.querySelector('[data-proof-zoom]');
  applySpotlight(frame,Number(slider?.value||frame.dataset.zoom*100)/100);
  slider?.addEventListener('input',()=>applySpotlight(frame,Number(slider.value)/100));
  container.querySelector('[data-proof-reset]')?.addEventListener('click',()=>{const box=frame.parentElement.querySelector('[data-proof-zoom]'),scale=Number(frame.dataset.initialZoom)||1.5;if(box)box.value=Math.round(scale*100);applySpotlight(frame,scale);});
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
  container.querySelector('[data-proof-zoom]')?.addEventListener('input',()=>requestAnimationFrame(update));
}
function mountCartonDrag(container,onRotation){
  const scene=container.querySelector('[data-carton-scene]'),model=scene?.querySelector('[data-carton-model]');if(!scene||!model||scene.dataset.dragMounted)return;scene.dataset.dragMounted='true';
  const slider=container.querySelector('[data-carton-rotation]'),output=slider?.parentElement.querySelector('output');
  let drag=null;
  const rotate=(angle,tilt)=>{model.style.transform=`rotateX(${tilt}deg) rotateY(${angle}deg)`;scene.dataset.angle=String(angle);scene.dataset.tilt=String(tilt);if(slider)slider.value=String(Math.round(angle));if(output)output.textContent=`${Math.round(angle)}°`;onRotation?.(angle,tilt);};
  scene.addEventListener('pointerdown',event=>{if(event.button!==0||event.target.closest('[data-action]'))return;const savedAngle=Number(scene.dataset.angle),savedTilt=Number(scene.dataset.tilt);drag={x:event.clientX,y:event.clientY,angle:Number.isFinite(savedAngle)?savedAngle:-22,tilt:Number.isFinite(savedTilt)?savedTilt:-7};scene.classList.add('dragging');scene.setPointerCapture?.(event.pointerId);event.preventDefault();});
  scene.addEventListener('pointermove',event=>{if(!drag)return;const angle=Math.max(-180,Math.min(180,drag.angle+(event.clientX-drag.x)*.7));const tilt=Math.max(-38,Math.min(25,drag.tilt-(event.clientY-drag.y)*.45));rotate(angle,tilt);});
  const stop=()=>{drag=null;scene.classList.remove('dragging');};scene.addEventListener('pointerup',stop);scene.addEventListener('pointercancel',stop);
  container.querySelector('[data-carton-reset]')?.addEventListener('click',()=>rotate(-22,-7));
}
export function mountArtworkControls(container,{review,onRotation}={}){
  if(!container)return;
  if(!container.dataset.artMounted){container.dataset.artMounted='true';
    container.addEventListener('change',event=>{const input=event.target.closest('[data-art-page]');if(!input)return;const wrapper=input.closest('[data-artwork-map]');if(!wrapper)return;const next=document.createElement('div');next.innerHTML=artworkMap(review,{page:Number(input.value)});wrapper.replaceWith(next.firstElementChild);mountArtworkControls(container,{review,onRotation});});
    const scrolls=[...container.querySelectorAll('.revision-scroll')];for(const scroll of scrolls)scroll.addEventListener('scroll',()=>{if(scroll.dataset.syncing)return;for(const other of scrolls)if(other!==scroll){other.dataset.syncing='1';other.scrollTop=scroll.scrollTop;other.scrollLeft=scroll.scrollLeft;delete other.dataset.syncing;}},{passive:true});
  }
  const frame=container.querySelector('[data-workbench-frame]');
  if(frame&&!frame.dataset.mounted){frame.dataset.mounted='true';const slider=container.querySelector('[data-workbench-zoom]'),imageLayer=frame.querySelector('[data-workbench-image]'),coordinate=container.querySelector('[data-cursor-coordinate]');
    const setZoom=value=>{const scale=Math.max(1,Math.min(3,Number(value)/100||1));frame.dataset.zoom=String(Math.round(scale*100));if(imageLayer)imageLayer.style.transform=`scale(${scale})`;if(slider?.parentElement.querySelector('output'))slider.parentElement.querySelector('output').textContent=`${Math.round(scale*100)}%`;};
    setZoom(slider?.value||100);slider?.addEventListener('input',()=>setZoom(slider.value));
    container.querySelector('[data-layer-boxes]')?.addEventListener('change',event=>frame.classList.toggle('hide-boxes',!event.target.checked));
    container.querySelector('[data-layer-zones]')?.addEventListener('change',event=>frame.classList.toggle('hide-zones',!event.target.checked));
    frame.addEventListener('pointermove',event=>{if(!coordinate)return;const rect=frame.getBoundingClientRect(),scale=Number(frame.dataset.zoom)/100||1;const x=Math.max(0,Math.min(1,.5+(event.clientX-rect.left-rect.width/2)/(rect.width*scale)));const y=Math.max(0,Math.min(1,.5+(event.clientY-rect.top-rect.height/2)/(rect.height*scale)));if(frame.dataset.unit==='pt'){const mmX=x*Number(frame.dataset.pageWidth)*25.4/72,mmY=y*Number(frame.dataset.pageHeight)*25.4/72;coordinate.textContent=`X ${mmX.toFixed(1)} mm · Y ${mmY.toFixed(1)} mm`;}else coordinate.textContent=`X ${(x*100).toFixed(1)}% · Y ${(y*100).toFixed(1)}% · physical size unavailable`;});
    frame.addEventListener('pointerleave',()=>{if(coordinate)coordinate.textContent='X — · Y —';});verifyDisplayedSource(container,review);
  }
  mountSpotlight(container);mountTraceConnector(container);mountCartonDrag(container,onRotation);
}
