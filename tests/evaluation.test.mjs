import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');

test('the labelled synthetic engine evaluation produces every expected outcome',()=>{
  const output=execFileSync(process.execPath,['scripts/evaluate-engine.mjs'],{cwd:root,encoding:'utf8'});
  const result=JSON.parse(output);
  assert.equal(result.metrics.totalCases,21);
  assert.equal(result.metrics.expectedOutcomesMatched,21);
  assert.equal(result.outcomes.filter(item=>item.group==='clean'&&item.actual==='issue').length,0);
});
