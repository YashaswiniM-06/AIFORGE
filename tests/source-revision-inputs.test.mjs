import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSourceRevisionInputs } from '../lib/source-revision-inputs.mjs';

test('source revision replaces selected references and preserves all other review inputs in order', async () => {
  const previous = [
    { id: 'art', name: 'carton.pdf', role: 'artwork' },
    { id: 'spec', name: 'old-spec.json', role: 'spec' },
    { id: 'rules', name: 'checklist.json', role: 'rules' },
    { id: 'dieline', name: 'carton.dxf', role: 'dieline' },
  ];
  const replacements = [{ replacesFileId: 'spec', name: 'new-spec.json', role: 'spec', base64: 'bmV3' }];
  const files = await buildSourceRevisionInputs(previous, replacements, async file => Buffer.from(`kept:${file.id}`));
  assert.deepEqual(files.map(file => [file.name, file.role]), [
    ['carton.pdf', 'artwork'], ['new-spec.json', 'spec'], ['checklist.json', 'rules'], ['carton.dxf', 'dieline'],
  ]);
  assert.equal(files[1].base64, 'bmV3');
  assert.equal(Buffer.from(files[0].base64, 'base64').toString(), 'kept:art');
  assert.equal(Buffer.from(files[2].base64, 'base64').toString(), 'kept:rules');
  assert.equal(Buffer.from(files[3].base64, 'base64').toString(), 'kept:dieline');
});

test('source revision refuses artwork replacement, duplicate targets, and role changes', async () => {
  const previous = [
    { id: 'art', name: 'carton.pdf', role: 'artwork' },
    { id: 'spec', name: 'spec.json', role: 'spec' },
  ];
  const readOriginal = async () => Buffer.from('original');
  await assert.rejects(buildSourceRevisionInputs(previous, [{ replacesFileId: 'art', name: 'new.pdf', role: 'artwork', base64: 'bmV3' }], readOriginal), /existing product specification/);
  await assert.rejects(buildSourceRevisionInputs(previous, [
    { replacesFileId: 'spec', name: 'a.json', role: 'spec', base64: 'YQ==' },
    { replacesFileId: 'spec', name: 'b.json', role: 'spec', base64: 'Yg==' },
  ], readOriginal), /only once/);
  await assert.rejects(buildSourceRevisionInputs(previous, [{ replacesFileId: 'spec', name: 'rules.json', role: 'rules', base64: 'YQ==' }], readOriginal), /keep the source role/);
});
