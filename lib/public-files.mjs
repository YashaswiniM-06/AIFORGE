import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { brotliCompress, gzip, constants } from 'node:zlib';

export const publicFiles = new Map([
  ['/','index.html'],
  ['/index.html','index.html'],
  ['/app.js','app.js'],
  ['/styles.css','styles.css'],
  ['/icon.svg','icon.svg'],
  ['/artwork-ui.js','artwork-ui.js'],
  ['/cad-carton.js','cad-carton.js'],
  ['/camera-intake.js','camera-intake.js'],
  ['/artwork-viewport.js','artwork-viewport.js'],
  ['/artwork.css','artwork.css'],
  ['/walkthrough.js','walkthrough.js'],
  ['/panel-zones.js','panel-zones.js'],
  ['/dieline-layout.js','dieline-layout.js'],
  ['/review-pipeline.js','review-pipeline.js'],
  ['/storage-disclosure.js','storage-disclosure.js'],
  ['/engine-status-copy.js','engine-status-copy.js'],
  ['/review-summary.js','review-summary.js'],
  ['/source-impact.js','source-impact.js'],
  ['/team-review.js','team-review.js'],
  ['/review-actions.js','review-actions.js'],
]);

const compressBrotli = promisify(brotliCompress);
const compressGzip = promisify(gzip);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function encodingFor(header = '') {
  const qualities = new Map(header.toLowerCase().split(',').map(part => {
    const [name, ...parameters] = part.trim().split(';');
    const quality = parameters.find(value => value.trim().startsWith('q='));
    const parsed = quality === undefined ? 1 : Number(quality.trim().slice(2));
    return [name.trim(), Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0];
  }));
  const available = ['br', 'gzip'].map(name => ({ name, quality: qualities.get(name) ?? qualities.get('*') ?? 0 }));
  // An explicitly preferred identity representation must remain available.
  if (qualities.has('identity')) available.push({ name: 'identity', quality: qualities.get('identity') });
  const preferred = available.filter(item => item.quality > 0).sort((a, b) => b.quality - a.quality)[0]?.name;
  if (preferred) return preferred;
  if ((qualities.get('identity') ?? (qualities.get('*') === 0 ? 0 : 1)) > 0) return 'identity';
}

export function createPublicFileSender(directory) {
  const cache = new Map();
  return async function sendPublicFile(req, res, route) {
    const filename = publicFiles.get(route);
    if (!filename) throw Object.assign(new Error('Public asset not found.'), { status: 404 });
    const path = join(directory, filename);
    const info = await stat(path);
    const revision = `${info.mtimeMs}:${info.ctimeMs}:${info.size}`;
    let entry = cache.get(filename);
    if (entry?.revision !== revision) {
      // Share one asynchronous compression job between concurrent requests.
      const pending = (async () => {
        const source = await readFile(path);
        const [br, compressed] = await Promise.all([
          compressBrotli(source, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }),
          compressGzip(source),
        ]);
        return { digest: createHash('sha256').update(source).digest('base64url'), bodies: { identity: source, br, gzip: compressed } };
      })();
      entry = { revision, pending };
      cache.set(filename, entry);
      pending.catch(() => { if (cache.get(filename) === entry) cache.delete(filename); });
    }
    const encoding = encodingFor(req.headers['accept-encoding']);
    if (!encoding) {
      res.writeHead(406, { 'Cache-Control': 'no-store', Vary: 'Accept-Encoding' });
      res.end();
      return;
    }
    const asset = await entry.pending;
    const etag = `"${asset.digest}-${encoding}"`;
    // Revalidate on each visit so a deployment is visible immediately. The
    // browser may retain these public UI bytes, but shared proxies may not.
    const headers = { 'Content-Type': types[extname(filename)] || 'application/octet-stream', 'Cache-Control': 'private, no-cache', Vary: 'Accept-Encoding', ETag: etag };
    if (encoding !== 'identity') headers['Content-Encoding'] = encoding;
    const matches = (req.headers['if-none-match'] || '').split(',').some(value => value.trim() === '*' || value.trim().replace(/^W\//, '') === etag);
    if (matches) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    const content = asset.bodies[encoding];
    res.writeHead(200, { ...headers, 'Content-Length': content.length });
    res.end(req.method === 'HEAD' ? undefined : content);
  };
}
