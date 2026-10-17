import { mkdir,readFile,rename,rm,stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
await mkdir('submission',{recursive:true});
const manifest=JSON.parse(await readFile('submission/package-files.json','utf8'));
const temp='submission/packsignal-'+randomUUID()+'.zip';
const result=spawnSync('zip',['-q','-r',temp,...manifest.include,'-x','*/__pycache__/*','*/previews/*','*.DS_Store'],{stdio:'inherit'});
if(result.status!==0){await rm(temp,{force:true});process.exitCode=result.status||1;}
else {
  const listing=spawnSync('unzip',['-Z1',temp],{encoding:'utf8'});
  if(listing.status!==0){await rm(temp,{force:true});throw new Error('Could not verify source package contents.');}
  const unsafe=listing.stdout.split(/\r?\n/).filter(name=>name&&((/(^|\/)\.env(?:$|\.)/.test(name)&&!/(^|\/)\.env\.example$/.test(name))||/(^|\/)\.packproof(?:\/|$)/.test(name)));
  if(unsafe.length){await rm(temp,{force:true});throw new Error(`Refusing to package private configuration or review data: ${unsafe.join(', ')}`);}
  const info=await stat(temp);if(info.size>50_000_000){await rm(temp);throw new Error('Source package exceeds the submission field limit.');}await rename(temp,'submission/packsignal-source.zip');console.log(`Created submission/packsignal-source.zip (${(info.size/1_000_000).toFixed(2)} MB; private configuration and review data excluded)`);
}
