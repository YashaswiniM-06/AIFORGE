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
  const labels = (document?.panelLabels || [])
    .filter(item => Number.isInteger(item.page) && Array.isArray(item.box) && item.box.length === 4)
    .map(item => ({ ...item, face: faceFromLabel(item.text, selected.id) }))
    .filter(item => item.face && selected.faces.includes(item.face));
  const zones = {};
  const folds = [];
  const byPage = new Map();
  for (const label of labels) {
    if (!byPage.has(label.page)) byPage.set(label.page, []);
    byPage.get(label.page).push(label);
  }

  for (const [page, pageLabels] of byPage) {
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

  return {
    type: selected.id,
    faces: selected.faces.map(face => ({ face, label: packageFaceLabel(selected.id, face), suggested: Boolean(zones[face]) })),
    zones,
    folds,
    labelCount: labels.length,
    pages: [...new Set(labels.map(item => item.page))],
    note: labels.length
      ? 'Face labels are extracted from the dieline. Regions and fold cues are coarse layout suggestions; inspect them against the actual cut and crease lines before use.'
      : 'No positioned face labels were found. The package type suggests which faces to map, but no coordinates or folds have been guessed.',
  };
}
