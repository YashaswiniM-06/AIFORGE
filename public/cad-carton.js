const MILLIMETERS_PER_UNIT = {
  millimeters: 1,
  centimeters: 10,
  meters: 1000,
  inches: 25.4,
  feet: 304.8,
  mils: 0.0254,
};

const cartonFaces = ['front', 'back', 'left', 'right', 'top', 'bottom'];
const closeEnough = (a, b, tolerance = Math.max(0.25, Math.max(Math.abs(a), Math.abs(b)) * 0.005)) => Math.abs(a - b) <= tolerance;

function rectangle(region, page, scale) {
  const points = region?.points;
  if (!Array.isArray(points) || points.length !== 4 || points.some(point => !Array.isArray(point) || point.length !== 2 || point.some(value => !Number.isFinite(value)))) return null;
  const xs = [...new Set(points.map(point => Math.round(point[0] * 1e8) / 1e8))].sort((a, b) => a - b);
  const ys = [...new Set(points.map(point => Math.round(point[1] * 1e8) / 1e8))].sort((a, b) => a - b);
  if (xs.length !== 2 || ys.length !== 2) return null;
  if (new Set(points.map(([x, y]) => `${Math.round(x * 1e8)},${Math.round(y * 1e8)}`)).size !== 4) return null;
  const corners = new Set(points.map(([x, y]) => `${Math.round(x * 1e8)},${Math.round(y * 1e8)}`));
  if (![`${Math.round(xs[0] * 1e8)},${Math.round(ys[0] * 1e8)}`, `${Math.round(xs[0] * 1e8)},${Math.round(ys[1] * 1e8)}`, `${Math.round(xs[1] * 1e8)},${Math.round(ys[0] * 1e8)}`, `${Math.round(xs[1] * 1e8)},${Math.round(ys[1] * 1e8)}`].every(value => corners.has(value))) return null;
  const pageWidth = Number(page.width), pageHeight = Number(page.height);
  if (!(pageWidth > 0 && pageHeight > 0)) return null;
  return {
    x0: xs[0], x1: xs[1], y0: ys[0], y1: ys[1],
    width: (xs[1] - xs[0]) * pageWidth * scale,
    height: (ys[1] - ys[0]) * pageHeight * scale,
    page: region.page,
    sourceLabel: region.sourceLabel,
    layer: region.layer,
  };
}

function isBoundaryCrease(line, panels) {
  if (line?.kind !== 'crease' || !Array.isArray(line.points) || line.points.length !== 2) return false;
  const [[x0, y0], [x1, y1]] = line.points;
  if (![x0, y0, x1, y1].every(Number.isFinite)) return false;
  const epsilon = 1e-6;
  return panels.some(panel => {
    const vertical = Math.abs(x0 - x1) <= epsilon && (Math.abs(x0 - panel.x0) <= epsilon || Math.abs(x0 - panel.x1) <= epsilon);
    const horizontal = Math.abs(y0 - y1) <= epsilon && (Math.abs(y0 - panel.y0) <= epsilon || Math.abs(y0 - panel.y1) <= epsilon);
    if (vertical) return Math.min(Math.max(y0, y1), panel.y1) - Math.max(Math.min(y0, y1), panel.y0) > epsilon;
    if (horizontal) return Math.min(Math.max(x0, x1), panel.x1) - Math.max(Math.min(x0, x1), panel.x0) > epsilon;
    return false;
  });
}

/**
 * Derive a dimensionally faithful, right-angle carton shell only when the
 * supplied DXF has physical units, six uniquely labelled rectangular panels,
 * and explicit crease geometry. This does not model board caliper or tabs.
 */
export function reconstructDxfCarton(document, type = 'carton') {
  if (type !== 'carton') return { ok: false, reason: 'Only a rectilinear carton shell is supported for CAD-derived reconstruction.' };
  if (document?.vectorGeometry?.format !== 'DXF') return { ok: false, reason: 'Upload an ASCII DXF dieline to derive package geometry.' };
  const units = String(document.vectorGeometry.units || document.pages?.[0]?.unit || '').toLowerCase();
  const unitScale = MILLIMETERS_PER_UNIT[units];
  if (!unitScale) return { ok: false, reason: 'The DXF must specify millimeters, centimeters, meters, inches, feet, or mils.' };
  if (document.vectorGeometry.unsupportedEntities?.length) return { ok: false, reason: 'The DXF contains unsupported CAD entities, so a complete reconstruction cannot be verified.' };
  const page = document.pages?.find(item => item.number === 1);
  if (!page) return { ok: false, reason: 'The DXF page dimensions are unavailable.' };

  const panels = {};
  for (const face of cartonFaces) {
    const matches = (document.vectorRegions || []).filter(region => region.page === page.number && region.face === face && region.sourceLabel);
    if (matches.length !== 1) return { ok: false, reason: `The DXF needs exactly one closed, labeled ${face} panel.` };
    const panel = rectangle(matches[0], page, unitScale);
    if (!panel || !(panel.width > 0 && panel.height > 0)) return { ok: false, reason: `The labeled ${face} panel is not a four-corner rectangle.` };
    panels[face] = panel;
  }

  const front = panels.front;
  const dimensions = { width: front.width, height: front.height, depth: panels.left.width };
  const consistent = closeEnough(panels.back.width, dimensions.width) && closeEnough(panels.back.height, dimensions.height) &&
    closeEnough(panels.left.height, dimensions.height) && closeEnough(panels.right.height, dimensions.height) &&
    closeEnough(panels.left.width, dimensions.depth) && closeEnough(panels.right.width, dimensions.depth) &&
    [panels.top, panels.bottom].every(panel => (closeEnough(panel.width, dimensions.width) && closeEnough(panel.height, dimensions.depth)) || (closeEnough(panel.height, dimensions.width) && closeEnough(panel.width, dimensions.depth)));
  if (!consistent) return { ok: false, reason: 'The six labeled panels do not describe one consistent rectangular carton.' };

  const creaseKeys = new Set();
  const creaseLines = (document.vectorLines || []).filter(line => {
    if (line.page !== page.number || !isBoundaryCrease(line, Object.values(panels))) return false;
    const key = line.points.map(point => point.map(value => Math.round(value * 1e6))).map(point => point.join(',')).sort().join('|');
    if (creaseKeys.has(key)) return false;
    creaseKeys.add(key);
    return true;
  });
  if (creaseLines.length < 4) return { ok: false, reason: 'At least four explicit crease segments must meet the labeled face boundaries.' };

  return {
    ok: true,
    kind: 'rectilinear-carton-shell',
    units: 'mm',
    dimensions,
    panels,
    creaseCount: creaseLines.length,
    sourceLabel: document.name || 'DXF dieline',
    accuracyNote: 'External face proportions use the supplied DXF dimensions. Right-angle folds are assumed; board thickness, glue tabs, and non-rectangular details are not modeled.',
  };
}

export function cartonShellObj(model) {
  if (!model?.ok || model.kind !== 'rectilinear-carton-shell') throw new Error('A validated DXF-dimensioned carton shell is required.');
  const { width, height, depth } = model.dimensions;
  if (![width, height, depth].every(value => Number.isFinite(value) && value > 0)) throw new Error('The carton shell dimensions are invalid.');
  const x = width / 2, z = depth / 2;
  const vertices = [
    [-x, 0, z], [x, 0, z], [x, height, z], [-x, height, z],
    [x, 0, -z], [-x, 0, -z], [-x, height, -z], [x, height, -z],
  ];
  const faces = [
    ['Front', [1, 2, 3, 4]], ['Right', [2, 5, 8, 3]], ['Back', [5, 6, 7, 8]],
    ['Left', [1, 4, 7, 6]], ['Top', [4, 3, 8, 7]], ['Bottom', [1, 6, 5, 2]],
  ];
  return [
    `# PackSignal DXF-dimensioned carton outer shell`,
    `# Units: millimeters; right-angle folds assumed; board thickness, tabs and detailed cut geometry omitted.`,
    `# Source: ${String(model.sourceLabel || 'DXF dieline').replace(/[\r\n]/g, ' ')}`,
    'o PackSignal_Carton_Shell',
    ...vertices.map(vertex => `v ${vertex.map(value => Number(value.toFixed(4))).join(' ')}`),
    ...faces.flatMap(([name, indices]) => [`g ${name}`, `f ${indices.join(' ')}`]),
    '',
  ].join('\n');
}
