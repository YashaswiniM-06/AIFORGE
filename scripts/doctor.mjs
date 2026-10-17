import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const bundled=join(process.env.HOME||'','.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3');
const python=process.env.PACKPROOF_PYTHON||(existsSync(bundled)?bundled:'python3');
console.log('PackSignal environment');console.log('Node:',process.version,Number(process.versions.node.split('.')[0])>=24?'OK':'Node 24 required');console.log('Python:',python);
const result=spawnSync(python,['-c','import sys,pypdfium2,openpyxl,PIL,reportlab,docx; print("Python",sys.version.split()[0],"and all document libraries are available.")'],{encoding:'utf8',env:{...process.env,PYTHONPATH:[join(process.cwd(),'.packproof','python-deps'),process.env.PYTHONPATH].filter(Boolean).join(':')}});
console.log(result.stdout||'');if(result.status!==0){console.error('Install dependencies: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt');console.error('Then set PACKPROOF_PYTHON to the absolute .venv/bin/python path in .env.local.');process.exitCode=1;}
for(const file of ['public/index.html','lib/engine.mjs','samples/organizer/DancingFish_Granola_Berry_US_Carton.pdf','samples/organizer/DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx'])console.log(existsSync(file)?'OK':'MISSING',file);
console.log('No API key needed for local checks. API connectivity is checked only when an AI review is requested.');
