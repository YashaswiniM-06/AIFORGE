import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { analyze, compareRevisions } from '../lib/engine.mjs';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const cases=JSON.parse(await readFile(join(root,'samples/fieldday-v2/evaluation/engine-cases.json'),'utf8'));

function makeReview(testCase,artworkLines=testCase.artwork){
  const field=testCase.field||'storage_statement';
  const comparison=testCase.kind==='quantity'?'quantity_equivalence':testCase.kind==='uncompiled'?'uncompiled':'exact_copy';
  const expected=field.startsWith('nutrition.')?null:testCase.reference;
  const rule={id:'EVAL-01',title:`Evaluation · ${testCase.id}`,field,comparison,text:`Compare the ${field} with the supplied fictional reference.`,literal_expected:expected??null};
  const rules={id:'rules',name:'evaluation-rules.json',role:'rules',text:rule.text,lines:[],pages:[],cells:[],data:{rules:[rule]}};
  const sourceDocuments=[];
  const references=testCase.references||[testCase.reference];
  if(testCase.kind!=='missing-reference')references.forEach((value,index)=>{
    const product={};const nutrition={};
    if(field.startsWith('nutrition.'))nutrition[field.slice(10)]=Number.parseFloat(value);
    else if(value!==undefined)product[field]=value;
    sourceDocuments.push({id:`spec-${index}`,name:`approved-source-${index+1}.json`,role:'spec',text:`${field}: ${value??''}`,lines:[],pages:[],cells:[],data:{status:'APPROVED',product,nutrition}});
  });
  const lines=(artworkLines||[]).map((text,index)=>({text,page:1,line:index+1,box:[0.1,0.08+index*0.07,0.82,0.12+index*0.07]}));
  const artwork={id:'art',name:'synthetic-artwork.pdf',role:'artwork',text:lines.map(line=>line.text).join('\n'),lines,pages:[{number:1,width:1200,height:860,image:'page.png',method:'pdf_text'}],cells:[],data:null};
  const options={completeArtwork:testCase.complete===true,netQuantityConfirmed:testCase.netConfirmed===true};
  return {id:`eval-${testCase.id}`,documents:[artwork,...sourceDocuments,rules],options,decisions:{},audit:[]};
}

const outcomes=[];let analysisMs=0;
for(const testCase of cases){
  const started=performance.now();
  let actual,diagnostic='';
  if(testCase.kind==='revision'){
    const before=analyze(makeReview(testCase,testCase.before));
    const after=analyze(makeReview(testCase,testCase.after));
    const revision=compareRevisions({id:'before',findings:before.findings},{id:'after',findings:after.findings});
    actual=revision.changes.find(change=>change.change==='new_issue')?.change||revision.changes[0]?.change||'unchanged';
  }else {const finding=analyze(makeReview(testCase)).findings.find(item=>item.rule?.id==='rules:EVAL-01');actual=finding?.status||'missing';diagnostic=`${finding?.expected||''} | ${finding?.observed||''} | ${finding?.explanation||''}`;}
  const elapsedMs=performance.now()-started;analysisMs+=elapsedMs;
  outcomes.push({id:testCase.id,group:testCase.group,expected:testCase.expected,actual,pass:actual===testCase.expected,elapsedMs:Number(elapsedMs.toFixed(2)),...(diagnostic?{diagnostic}:{})});
}
const groupMetrics=group=>{
  const items=outcomes.filter(item=>item.group===group);
  const correct=items.filter(item=>item.pass).length;
  return {cases:items.length,correct,rate:items.length?Number((correct/items.length*100).toFixed(1)):null};
};
const metrics={
  totalCases:cases.length,
  expectedOutcomesMatched:outcomes.filter(item=>item.pass).length,
  defectsDetected:groupMetrics('defect'),
  falseAlarmsOnCleanContent:outcomes.filter(item=>item.group==='clean'&&item.actual==='issue').length,
  cleanCases:groupMetrics('clean'),
  comparisonsCompleted:outcomes.filter(item=>['match','issue'].includes(item.actual)).length,
  comparisonsUnableToVerify:outcomes.filter(item=>item.actual==='unable').length,
  ambiguousCasesRoutedToReview:groupMetrics('ambiguous'),
  unreadableCasesRoutedUnable:groupMetrics('unreadable'),
  revisionRegressionsCaught:groupMetrics('revision'),
  deterministicProcessingMs:{total:Number(analysisMs.toFixed(2)),average:Number((analysisMs/cases.length).toFixed(2))},
  scope:'Hand-authored synthetic regression cases for the deterministic local engine. Not an independent benchmark, regulatory validation, or a measured production accuracy claim.'
};
console.log(JSON.stringify({metrics,outcomes},null,2));
if(outcomes.some(item=>!item.pass))process.exitCode=1;
