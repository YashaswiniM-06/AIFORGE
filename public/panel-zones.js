const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const faces = [
  ['front', 'Front panel'], ['back', 'Back panel'], ['left', 'Left side'],
  ['right', 'Right side'], ['top', 'Top panel'], ['bottom', 'Bottom panel'],
];

function artwork(review) {
  return review.documents?.find(document => document.role === 'artwork');
}

function zoneBox(zone, page) {
  if (!zone?.box || zone.page !== page) return '';
  const [x0, y0, x1, y1] = zone.box;
  return `<div class="panel-zone ${escape(zone.name)}" style="left:${x0 * 100}%;top:${y0 * 100}%;width:${(x1 - x0) * 100}%;height:${(y1 - y0) * 100}%"><span>${escape(zone.name)} face</span></div>`;
}

function locatedEvidence(finding) {
  return finding?.evidence?.find(item => item.role === 'artwork' && Number.isInteger(item.page) && Array.isArray(item.box));
}

function insideZone(evidence, page, box) {
  if (!evidence?.box || evidence.page !== page || !box) return false;
  const [x0, y0, x1, y1] = evidence.box;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return cx >= box[0] && cx <= box[2] && cy >= box[1] && cy <= box[3];
}

function impactText(review, face, page, box) {
  const checks = (review.findings || []).filter(finding => finding.rule?.panel === face && finding.method !== 'panel_geometry');
  if (!checks.length) return `No supplied checklist checks target the ${face} face. Only checks that name this face can be evaluated against its zone.`;
  if (!box) return `${checks.length} supplied check${checks.length === 1 ? '' : 's'} target ${face}. Draw the face to preview located evidence.`;
  const located = checks.map(locatedEvidence).filter(Boolean);
  const onPage = located.filter(evidence => evidence.page === page);
  const inside = onPage.filter(evidence => insideZone(evidence, page, box)).length;
  const outside = onPage.length - inside;
  const elsewhere = located.length - onPage.length;
  const unlocated = checks.length - located.length;
  const details = [
    inside && `${inside} inside`, outside && `${outside} outside`,
    elsewhere && `${elsewhere} on another page`, unlocated && `${unlocated} without a text box`,
  ].filter(Boolean).join(' · ');
  return `${checks.length} supplied check${checks.length === 1 ? '' : 's'} target ${face}${details ? ` · ${details}` : ''}. Save to rerun those checklist geometry checks.`;
}

export function panelZoneMapper(review) {
  const artDocument = artwork(review);
  if (!artDocument?.pages?.length) return '';
  const zones = Object.entries(review.options?.panelZones || {}).map(([name, zone]) => ({ name, ...zone }));
  const page = artDocument.pages[0];
  const zoneNote = review.options?.panelZoneSource === 'authored synthetic sample geometry'
    ? 'Sample rectangles are illustrative starting points. Inspect them before use; they do not establish legal panel definitions.'
    : 'Draw each supplied artwork face. Only supplied checklist checks assigned to that face are recalculated.';
  return `<section class="panel panel-zone-panel" data-panel-zone-mapper>
    <div class="eyebrow">ARTWORK GEOMETRY</div>
    <h3>Map package faces</h3>
    <p class="subtle">${escape(zoneNote)}</p>
    <div class="zone-controls">
      <label>Face to map<select data-zone-name>${faces.map(([value, label]) => `<option value="${value}" ${value === 'front' ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label>Artwork page<select data-zone-page>${artDocument.pages.map(item => `<option value="${item.number}">Page ${item.number}</option>`).join('')}</select></label>
      <button type="button" class="secondary" data-zone-clear>Clear this face</button>
    </div>
    <div class="zone-impact" data-zone-impact aria-live="polite"></div>
    <details class="zone-screening"><summary>Optional text-height screening</summary><p class="subtle">This adds an approximate human-review finding when PDF text height can be measured. It is not a legal minimum.</p><label>Screening value (mm)<input type="number" data-legibility-threshold min="0.1" max="10" step="0.1" value="${Number(review.options?.legibilityThresholdMm) || 1.6}"></label></details>
    <input type="hidden" name="panelZones" data-panel-zones-value value="${escape(JSON.stringify(review.options?.panelZones || {}))}">
    <div class="zone-stage" data-zone-stage aria-label="Drag a rectangle around the selected package face on the artwork page">
      <img data-zone-image src="/api/reviews/${escape(review.id)}/images/${escape(page.image)}" alt="Artwork page ${page.number} for package face mapping">
      <div data-zone-overlay>${zones.map(zone => zoneBox(zone, page.number)).join('')}</div>
    </div>
    <p class="subtle" data-zone-status></p>
  </section>`;
}

export function mountPanelZoneMapper(container, review) {
  let root = container?.querySelector?.('[data-panel-zone-mapper]');
  if (!root) {
    const form = container?.querySelector?.('#source-form');
    if (!form) return;
    const fragment = globalThis.document.createElement('template');
    fragment.innerHTML = panelZoneMapper(review);
    root = fragment.content.firstElementChild;
    form.querySelector('h3')?.after(root);
  }
  if (root.dataset.mounted) return;
  root.dataset.mounted = 'true';
  const artDocument = artwork(review);
  const zoneValue = root.querySelector('[data-panel-zones-value]');
  const form = root.closest('#source-form');
  const threshold = root.querySelector('[data-legibility-threshold]');
  form?.addEventListener('formdata', event => {
    event.formData.set('panelZones', zoneValue.value);
    event.formData.set('legibilityThresholdMm', threshold.value);
  });
  const stage = root.querySelector('[data-zone-stage]');
  const image = root.querySelector('[data-zone-image]');
  const faceInput = root.querySelector('[data-zone-name]');
  const pageInput = root.querySelector('[data-zone-page]');
  const overlay = root.querySelector('[data-zone-overlay]');
  const status = root.querySelector('[data-zone-status]');
  const impact = root.querySelector('[data-zone-impact]');
  let zones = {};
  try { zones = JSON.parse(zoneValue.value || '{}'); } catch { zones = {}; }
  let start = null;
  const selected = () => faceInput.value;
  const selectedPage = () => Number(pageInput.value);
  const currentPage = () => artDocument.pages.find(page => page.number === selectedPage()) || artDocument.pages[0];
  const persist = () => { zoneValue.value = JSON.stringify(zones); };
  const updateImpact = (previewBox = null) => {
    const box = previewBox || zones[selected()]?.box;
    impact.textContent = impactText(review, selected(), selectedPage(), box);
  };
  const redraw = () => {
    const page = currentPage();
    image.src = `/api/reviews/${encodeURIComponent(review.id)}/images/${encodeURIComponent(page.image)}`;
    image.alt = `Artwork page ${page.number} for package face mapping`;
    overlay.innerHTML = Object.entries(zones).map(([name, zone]) => zoneBox({ name, ...zone }, page.number)).join('');
    const mapped = zones[selected()]?.page === page.number;
    status.textContent = mapped
      ? `${selected()} face mapped on page ${page.number}. Save to recalculate the supplied checklist geometry.`
      : `${selected()} face is not mapped on page ${page.number}. Drag over its artwork area to map it.`;
    updateImpact();
  };
  const point = event => {
    const rect = stage.getBoundingClientRect();
    return [Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))];
  };
  const preview = (from, to) => {
    const [x0, y0] = from, [x1, y1] = to;
    const box = [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
    overlay.querySelectorAll('.panel-zone.preview').forEach(node => node.remove());
    const node = globalThis.document.createElement('div');
    node.className = `panel-zone ${selected()} preview`;
    node.style.left = `${box[0] * 100}%`; node.style.top = `${box[1] * 100}%`;
    node.style.width = `${(box[2] - box[0]) * 100}%`; node.style.height = `${(box[3] - box[1]) * 100}%`;
    node.innerHTML = `<span>${escape(selected())} face</span>`; overlay.append(node);
    updateImpact(box);
  };
  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    start = point(event); stage.setPointerCapture?.(event.pointerId); event.preventDefault(); preview(start, start);
  });
  stage.addEventListener('pointermove', event => { if (start) preview(start, point(event)); });
  stage.addEventListener('pointerup', event => {
    if (!start) return;
    const end = point(event); const box = [Math.min(start[0], end[0]), Math.min(start[1], end[1]), Math.max(start[0], end[0]), Math.max(start[1], end[1])];
    start = null; overlay.querySelectorAll('.panel-zone.preview').forEach(node => node.remove());
    if ((box[2] - box[0]) < 0.03 || (box[3] - box[1]) < 0.03) { status.textContent = 'Draw a larger rectangle to map this face.'; updateImpact(); return; }
    zones[selected()] = { page: selectedPage(), box }; persist(); redraw();
  });
  stage.addEventListener('pointercancel', () => { start = null; overlay.querySelectorAll('.panel-zone.preview').forEach(node => node.remove()); redraw(); });
  faceInput.addEventListener('change', redraw);
  pageInput.addEventListener('change', redraw);
  root.querySelector('[data-zone-clear]').addEventListener('click', () => { delete zones[selected()]; persist(); redraw(); });
  redraw();
}
