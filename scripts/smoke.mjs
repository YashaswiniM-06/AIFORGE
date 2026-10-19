import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const storage = await mkdtemp(join(tmpdir(), 'packsignal-smoke-'));
const keys = { GEMINI_API_KEY: ' ', GEMINI_API_KEY_2: ' ', GEMINI_API_KEY_3: ' ', GEMINI_API_KEY_4: ' ', GEMINI_API_KEY_5: ' ' };
const lineArtDieline = 'iVBORw0KGgoAAAANSUhEUgAAASwAAADIAQAAAAB6pOH4AAAAW0lEQVR42u3ZMQ6AMAgFUKrey/tPXqXG1aQOhqEb6fz+AiQvYWCkjSjk3qIUbI1F5Qp7Ly89R+b6y5vzk013BQzDMAzDMAzDMAzDMAzDMAzDMMyvbc4Rzf90iX0smiwhw6xoAwAAAABJRU5ErkJggg==';
const dxfSample = `0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n8\nCUT\n90\n4\n70\n1\n10\n0\n20\n0\n10\n100\n20\n0\n10\n100\n20\n100\n10\n0\n20\n100\n0\nLWPOLYLINE\n8\nPANEL\n90\n4\n70\n1\n10\n10\n20\n10\n10\n45\n20\n10\n10\n45\n20\n90\n10\n10\n20\n90\n0\nLWPOLYLINE\n8\nPANEL\n90\n4\n70\n1\n10\n55\n20\n10\n10\n90\n20\n10\n10\n90\n20\n90\n10\n55\n20\n90\n0\nLINE\n8\nCREASE\n10\n50\n20\n10\n11\n50\n21\n90\n0\nTEXT\n8\nLABELS\n10\n27\n20\n50\n1\nFRONT PANEL\n0\nTEXT\n8\nLABELS\n10\n72\n20\n50\n1\nBACK PANEL\n0\nENDSEC\n0\nEOF\n`;
let child;
let output = '';

async function freePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(base, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited early. ${output}`);
    try {
      const response = await fetch(`${base}/api/status`);
      if (response.ok) return response.json();
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Server did not become ready. ${output}`);
}

async function json(response) {
  const body = await response.json();
  assert.ok(response.ok, body.error || `Expected a successful response, got ${response.status}`);
  return body;
}

try {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      ...keys,
      PORT: String(port),
      PACKPROOF_DATA_DIR: storage,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.setEncoding('utf8').on('data', chunk => { output += chunk; });
  child.stderr.setEncoding('utf8').on('data', chunk => { output += chunk; });

  const status = await waitForServer(base);
  assert.equal(status.aiConfigured, false, 'Local smoke checks must not require or use an API key.');
  assert.equal(status.aiConnection, 'not_configured');
  assert.equal(status.configuredKeyCount, undefined, 'Status should not expose key-pool details.');
  assert.equal(status.limits.pdfPages, 12);

  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /PackSignal/);
  const clientScript = await (await fetch(`${base}/app.js`)).text();
  assert.doesNotMatch(clientScript, /id="api-key|settings-form|clear-key/,
    'The browser must not contain key-entry or key-clear controls.');
  assert.match(clientScript, /AI assisted · recommended/,
    'AI-assisted review should be the default mode.');
  for (const asset of ['/app.js', '/artwork-ui.js', '/dieline-layout.js', '/walkthrough.js', '/styles.css']) {
    const response = await fetch(`${base}${asset}`);
    assert.equal(response.status, 200, `${asset} is served`);
  }

  const blocked = await fetch(`${base}/api/reviews`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sample: 'organizer', mode: 'ai' }),
  });
  assert.equal(blocked.status, 403, 'Mutations require the in-session request token.');

  const created = await json(await fetch(`${base}/api/reviews`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-packproof-token': status.csrf },
    body: JSON.stringify({ sample: 'organizer', mode: 'ai' }),
  }));
  const deadline = Date.now() + 120_000;
  let review;
  while (Date.now() < deadline) {
    review = await json(await fetch(`${base}/api/reviews/${created.id}`));
    if (review.status === 'ready' || review.status === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  assert.equal(review?.status, 'ready', review?.error || 'Organizer review did not finish.');
  assert.equal(review.aiStatus, 'unavailable', 'AI mode without server credentials should finish locally and say why.');
  assert.match(review.aiError, /not configured/i);
  assert.equal(review.documents.length, 2);
  assert.ok(review.findings.length > 0, 'The real organizer files produce review findings.');
  assert.ok(review.documents.some(document => document.role === 'artwork' && document.pages.length));
  assert.ok(review.documents.some(document => document.role === 'spec' && document.cells.length));

  const dxfReview = await json(await fetch(`${base}/api/reviews`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-packproof-token': status.csrf },
    body: JSON.stringify({
      name: 'DXF geometry smoke test',
      mode: 'local',
      files: [
        { name: 'dxf-label.png', role: 'artwork', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jg4QAAAAASUVORK5CYII=' },
        { name: 'carton.dxf', role: 'dieline', base64: Buffer.from(dxfSample).toString('base64') },
        { name: 'dxf-spec.json', role: 'spec', base64: Buffer.from(JSON.stringify({ product_name: 'DXF smoke product', net_quantity: '100 g' })).toString('base64') },
      ],
    }),
  }));
  const dxfDeadline = Date.now() + 120_000;
  let dxfResult;
  while (Date.now() < dxfDeadline) {
    dxfResult = await json(await fetch(`${base}/api/reviews/${dxfReview.id}`));
    if (dxfResult.status === 'ready' || dxfResult.status === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  assert.equal(dxfResult?.status, 'ready', dxfResult?.error || 'DXF review did not finish.');
  const parsedDxf = dxfResult.documents.find(document => document.role === 'dieline');
  assert.equal(parsedDxf.vectorGeometry?.format, 'DXF');
  assert.equal(parsedDxf.vectorGeometry?.lineKinds?.crease, 1);
  assert.ok(parsedDxf.vectorGeometry?.lineKinds?.cut >= 4);
  assert.equal(parsedDxf.vectorRegions.filter(region => region.face === 'front').length, 1, 'A positioned label maps to its smallest closed region only.');
  assert.equal(parsedDxf.vectorRegions.filter(region => region.face === 'back').length, 1);
  const dxfPreview = await fetch(`${base}/api/reviews/${dxfReview.id}/images/${parsedDxf.pages[0].image}`);
  assert.equal(dxfPreview.status, 200);
  assert.match(dxfPreview.headers.get('content-type') || '', /image\/svg\+xml/);
  assert.match(await dxfPreview.text(), /stroke-dasharray/, 'Explicit crease layer semantics are visible in the vector preview.');

  const uploaded = await json(await fetch(`${base}/api/reviews`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-packproof-token': status.csrf },
    body: JSON.stringify({
      name: 'New upload panel-map smoke test',
      mode: 'local',
      files: [
        {
          name: 'new-label.png',
          role: 'artwork',
          base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jg4QAAAAASUVORK5CYII=',
        },
        {
          name: 'new-dieline.png',
          role: 'dieline',
          base64: lineArtDieline,
        },
        {
          name: 'product-spec.json',
          role: 'spec',
          base64: Buffer.from(JSON.stringify({ product_name: 'Smoke-test product', net_quantity: '100 g' })).toString('base64'),
        },
      ],
    }),
  }));
  const uploadDeadline = Date.now() + 120_000;
  let uploadedReview;
  while (Date.now() < uploadDeadline) {
    uploadedReview = await json(await fetch(`${base}/api/reviews/${uploaded.id}`));
    if (uploadedReview.status === 'ready' || uploadedReview.status === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  assert.equal(uploadedReview?.status, 'ready', uploadedReview?.error || 'Uploaded artwork review did not finish.');
  assert.equal(uploadedReview.sample, undefined, 'An uploaded review must remain a user review, not a built-in sample.');
  assert.deepEqual(uploadedReview.options.panelZones, {}, 'New uploads must not get guessed panel rectangles.');
  assert.equal(uploadedReview.options.panelZoneSource, undefined, 'New uploads must not claim an automated panel map.');
  assert.ok(uploadedReview.documents.some(document => document.role === 'dieline'));
  assert.equal(uploadedReview.options.packageType, 'carton');
  const dieline = uploadedReview.documents.find(document => document.role === 'dieline');
  assert.ok(dieline.structuralEdges.length >= 5, 'An unlabeled image dieline exposes detected long-line candidates.');
  assert.equal(uploadedReview.options.packageMappingConfirmed, false, 'A dieline upload must not show a package-specific 3D preview before reviewer confirmation.');
  const mapped = await json(await fetch(`${base}/api/reviews/${uploaded.id}/sources`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-packproof-token': status.csrf },
    body: JSON.stringify({
      reason: 'Reviewer checked the dieline and artwork face.',
      packageType: 'pouch',
      panelZones: { front: { page: 1, box: [.1, .1, .9, .9] } },
      packageMappingConfirmed: true,
    }),
  }));
  assert.equal(mapped.options.packageType, 'pouch');
  assert.equal(mapped.options.packageMappingConfirmed, true, 'Only an explicit confirmation with a front artwork crop enables the package preview.');
  const stale = await json(await fetch(`${base}/api/reviews/${uploaded.id}/sources`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-packproof-token': status.csrf },
    body: JSON.stringify({
      reason: 'Artwork face crop changed during review.',
      packageType: 'pouch',
      panelZones: { front: { page: 1, box: [.2, .1, .9, .9] } },
      packageMappingConfirmed: false,
    }),
  }));
  assert.equal(stale.options.packageMappingConfirmed, false);
  assert.equal(stale.options.staleConfirmations.packageMappingConfirmed, true, 'A changed artwork crop invalidates the saved package mapping.');

  const finding = review.findings[0];
  const decision = await json(await fetch(`${base}/api/reviews/${created.id}/decisions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-packproof-token': status.csrf },
    body: JSON.stringify({ findingId: finding.id, disposition: 'acknowledged', note: 'Smoke test reviewer decision.' }),
  }));
  assert.equal(decision.decisions[finding.id].disposition, 'acknowledged');
  assert.ok(decision.audit.some(item => item.action === 'reviewer_decision'));

  const html = await fetch(`${base}/api/reviews/${created.id}/report.html`);
  assert.equal(html.status, 200);
  const htmlText = await html.text();
  assert.match(htmlText, /PackSignal/);
  assert.match(htmlText, /Smoke test reviewer decision/);
  assert.match(htmlText, /verification/i);

  const signature = await json(await fetch(`${base}/api/reviews/${created.id}/signature`));
  assert.equal(signature.valid, true, 'Exported review seal verifies offline against its included key.');
  const pdf = await fetch(`${base}/api/reviews/${created.id}/report.pdf`);
  assert.equal(pdf.status, 200);
  assert.equal((await pdf.arrayBuffer()).byteLength > 1000, true, 'PDF report is generated.');

  console.log(JSON.stringify({
    result: 'PASS',
    scope: 'Local HTTP smoke test with official organizer files; AI default falls back cleanly without external credentials.',
    checks: [
      'public app and module routes',
      'API status and local-only configuration',
      'read-only credential-free Settings UI and AI-default fallback',
      'mutation token enforcement',
      'organizer PDF/XLSX ingestion and review completion',
      'ASCII DXF linework extraction, layer semantics, closed-panel suggestions, and SVG preview delivery',
      'new image upload review without guessed packaging panel geometry',
      'dieline upload, reviewer-confirmed pouch mapping, and stale-map invalidation',
      'reviewer decision and audit event',
      'portable HTML report and signed proof verification',
      'PDF report generation',
    ],
    findings: review.findings.length,
    counts: review.counts,
  }, null, 2));
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, 3000);
      child.once('exit', () => { clearTimeout(timeout); resolve(); });
    });
  }
  await rm(storage, { recursive: true, force: true });
}
