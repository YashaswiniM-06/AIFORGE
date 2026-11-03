export const packageTypes = [
  { id: 'carton', label: 'Carton', faces: ['front', 'back', 'left', 'right', 'top', 'bottom'] },
  { id: 'pouch', label: 'Pouch', faces: ['front', 'back', 'left', 'right', 'bottom'] },
  { id: 'bottle_label', label: 'Bottle label', faces: ['front', 'back', 'left', 'right'] },
  { id: 'sleeve', label: 'Sleeve', faces: ['front', 'back', 'left', 'right'] },
];

export const packageType = value => packageTypes.find(item => item.id === value) || packageTypes[0];

export function packageFaceLabel(type, face) {
  const labels = {
    front: type === 'bottle_label' ? 'Label front' : 'Front panel',
    back: type === 'bottle_label' ? 'Label back' : 'Back panel',
    left: type === 'bottle_label' ? 'Wrap left' : type === 'pouch' ? 'Left gusset' : 'Left side',
    right: type === 'bottle_label' ? 'Wrap right' : type === 'pouch' ? 'Right gusset' : 'Right side',
    top: 'Top panel',
    bottom: type === 'pouch' ? 'Bottom gusset' : 'Bottom panel',
  };
  return labels[face] || face;
}

function faceFromLabel(text, type) {
  const value = String(text || '').normalize('NFKC').toLowerCase();
  if (/\bfront\b/.test(value) || (type === 'bottle_label' && /\blabel\s*a\b/.test(value))) return 'front';
  if (/\b(?:back|rear)\b/.test(value) || (type === 'bottle_label' && /\blabel\s*b\b/.test(value))) return 'back';
  if (/\bleft\b/.test(value)) return 'left';
  if (/\bright\b/.test(value)) return 'right';
  if (/\btop\b/.test(value)) return 'top';
  if (/\bbottom\b/.test(value)) return 'bottom';
  if (/\b(?:side|gusset)\b/.test(value) && type === 'pouch') return 'left';
  return null;
}

const center = box => [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];

function groupRows(labels) {
  const rows = [];
  for (const label of [...labels].sort((a, b) => center(a.box)[1] - center(b.box)[1])) {
    const y = center(label.box)[1];
    let row = rows.find(item => Math.abs(item.center - y) <= 0.12);
    if (!row) rows.push(row = { center: y, labels: [] });
    row.labels.push(label);
    row.center = row.labels.reduce((sum, item) => sum + center(item.box)[1], 0) / row.labels.length;
  }
  return rows.sort((a, b) => a.center - b.center);
}

/**
 * Return cautious, editable face-region suggestions from positioned PDF labels.
 * These are layout hints, not cut/crease recognition or CAD geometry.
 */
export function suggestDielineMapping(document, type = 'carton') {
  const selected = packageType(type);
  const isStructuredDxf = document?.vectorGeometry?.format === 'DXF';
  const labels = (document?.panelLabels || [])
    .filter(item => Number.isInteger(item.page) && Array.isArray(item.box) && item.box.length === 4)
    .map(item => ({ ...item, face: faceFromLabel(item.text, selected.id) }))
    .filter(item => item.face && selected.faces.includes(item.face));
  const zones = {};
  const folds = [];
  const edges = (document?.structuralEdges || [])
    .filter(item => Number.isInteger(item.page) && ['vertical', 'horizontal'].includes(item.axis) && Number.isFinite(item.position))
    .map(item => ({ ...item, position: Math.max(0, Math.min(1, item.position)), extent: Array.isArray(item.extent) ? item.extent.map(value => Math.max(0, Math.min(1, Number(value) || 0))) : [0, 1] }));
  const byPage = new Map();
  for (const label of labels) {
    if (!byPage.has(label.page)) byPage.set(label.page, []);
    byPage.get(label.page).push(label);
  }

  if (isStructuredDxf) {
    // A labelled closed DXF region is a geometry-backed suggestion. If the
    // same face label occurs more than once, leave it for the reviewer.
    for (const face of selected.faces) {
      const matches = (document.vectorRegions || []).filter(region =>
        region.face === face && Number.isInteger(region.page) && Array.isArray(region.box) && region.box.length === 4 &&
        Number.isFinite(region.area) && region.area > 0 && region.area < 0.9
      );
      if (matches.length === 1) {
        const region = matches[0];
        zones[face] = { page: region.page, box: region.box, sourceLabel: region.sourceLabel, sourceGeometry: 'closed DXF region' };
      }
    }
  }

  for (const [page, pageLabels] of isStructuredDxf ? [] : byPage) {
    const rows = groupRows(pageLabels);
    const rowBounds = rows.map((row, index) => ({
      top: index === 0 ? 0 : (rows[index - 1].center + row.center) / 2,
      bottom: index === rows.length - 1 ? 1 : (row.center + rows[index + 1].center) / 2,
      row,
    }));
    for (let index = 0; index < rows.length - 1; index++) {
      folds.push({ page: Number(page), axis: 'horizontal', position: (rows[index].center + rows[index + 1].center) / 2 });
    }
    for (const { top, bottom, row } of rowBounds) {
      const sorted = [...row.labels].sort((a, b) => center(a.box)[0] - center(b.box)[0]);
      if (sorted.length < 2) continue;
      const xBounds = sorted.map((item, index) => ({
        left: index === 0 ? 0 : (center(sorted[index - 1].box)[0] + center(item.box)[0]) / 2,
        right: index === sorted.length - 1 ? 1 : (center(item.box)[0] + center(sorted[index + 1].box)[0]) / 2,
        item,
      }));
      for (const { left, right, item } of xBounds) {
        if (!zones[item.face]) zones[item.face] = { page, box: [left, top, right, bottom], sourceLabel: item.text };
        if (right < 1) folds.push({ page: Number(page), axis: 'vertical', position: right, before: item.face, after: sorted[xBounds.findIndex(zone => zone.item === item) + 1]?.face });
      }
    }
  }

  for (const edge of edges) {
    if (!folds.some(fold => fold.page === edge.page && fold.axis === edge.axis && Math.abs(fold.position - edge.position) < 0.015)) {
      folds.push({ page: edge.page, axis: edge.axis, position: edge.position, extent: edge.extent, source: edge.source || 'rendered line candidate' });
    }
  }

  const candidateRegions = [];
  if (isStructuredDxf) {
    for (const region of document.vectorRegions || []) {
      if (!Number.isInteger(region.page) || !Array.isArray(region.box) || region.box.length !== 4 || !Number.isFinite(region.area) || region.area <= 0 || region.area >= 0.9) continue;
      candidateRegions.push({
        page: region.page,
        box: region.box,
        label: region.sourceLabel || `${region.layer || 'DXF region'} region`,
        face: selected.faces.includes(region.face) ? region.face : undefined,
        sourceGeometry: 'closed DXF polyline',
      });
    }
  } else for (const page of [...new Set(edges.map(edge => edge.page))]) {
    const vertical = [...new Set(edges.filter(edge => edge.page === page && edge.axis === 'vertical').map(edge => edge.position))].sort((a, b) => a - b);
    const horizontal = [...new Set(edges.filter(edge => edge.page === page && edge.axis === 'horizontal').map(edge => edge.position))].sort((a, b) => a - b);
    const verticalSpans = edges.filter(edge => edge.page === page && edge.axis === 'vertical').flatMap(edge => edge.extent || []);
    const xs = vertical.length >= 2 ? vertical : [0, 1];
    const ys = horizontal.length >= 2 ? horizontal : verticalSpans.length >= 2 ? [Math.min(...verticalSpans), Math.max(...verticalSpans)] : [0, 1];
    let index = 1;
    for (let row = 0; row < ys.length - 1; row++) for (let column = 0; column < xs.length - 1; column++) {
      const box = [xs[column], ys[row], xs[column + 1], ys[row + 1]];
      if (box[2] - box[0] < 0.04 || box[3] - box[1] < 0.08) continue;
      candidateRegions.push({ page, box, label: `Unlabelled region ${index++}` });
      if (candidateRegions.length >= 24) break;
    }
  }

  return {
    type: selected.id,
    faces: selected.faces.map(face => ({ face, label: packageFaceLabel(selected.id, face), suggested: Boolean(zones[face]) })),
    zones,
    folds,
    edges,
    candidateRegions,
    labelCount: labels.length,
    pages: [...new Set(labels.map(item => item.page))],
    note: isStructuredDxf
      ? `Structured DXF geometry: ${document.vectorGeometry.lineCount || 0} drawn line segments across cut (${document.vectorGeometry.lineKinds?.cut || 0}), crease (${document.vectorGeometry.lineKinds?.crease || 0}), glue (${document.vectorGeometry.lineKinds?.glue || 0}), and other layers. Only explicit layer names classify line purpose. ${Object.keys(zones).length} uniquely labelled closed face region(s) can be copied; confirm every crop. The package-shaped 3D preview remains illustrative.`
      : labels.length
      ? 'Positioned face labels suggest identities. Long straight strokes add boundary cues; line style alone cannot tell cut from crease. Inspect every suggestion against the source before use.'
      : edges.length
        ? `${edges.length} long straight line candidates and ${candidateRegions.length} unlabelled regions were found. They are visual cues only; assign faces manually and verify cut versus crease in the source.`
        : 'No positioned face labels or clear long straight lines were found. The package type lists faces, but their positions still need manual mapping.',
  };
}
