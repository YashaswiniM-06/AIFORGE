import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { publicFiles } from '../lib/public-files.mjs';

test('every public HTML asset and recursively imported app module has an explicit server route', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const htmlAssets = [...html.matchAll(/(?:src|href)="(\/[^"?#]+)"/g)].map(match => match[1]);
  const pending = new Set(['app.js']);
  const visited = new Set();

  for (const route of htmlAssets) {
    const filename = publicFiles.get(route);
    assert.ok(filename, `public HTML asset ${route} has a server route`);
    await access(resolve(new URL('../public/', import.meta.url).pathname, filename));
    if (filename.endsWith('.js')) pending.add(filename);
  }

  while (pending.size) {
    const filename = pending.values().next().value;
    pending.delete(filename);
    if (visited.has(filename)) continue;
    visited.add(filename);
    const source = await readFile(new URL(`../public/${filename}`, import.meta.url), 'utf8');
    const imports = [...source.matchAll(/\bimport\s*(?:[^'";]*?\sfrom\s*)?["'](\.[^"']+)["']/g)];
    for (const match of imports) {
      const dependency = new URL(match[1], `file://${resolve(new URL('../public/', import.meta.url).pathname, filename)}`);
      const dependencyPath = decodeURIComponent(dependency.pathname);
      const dependencyName = dependencyPath.split('/').at(-1);
      assert.ok(publicFiles.has(`/${dependencyName}`), `${filename} import ${match[1]} has an explicit server route`);
      await access(dependencyPath);
      pending.add(dependencyName);
    }
  }
});
