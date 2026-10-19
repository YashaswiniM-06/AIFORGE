import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze, compareRevisions, equalQuantity, extractFacts, normal, quantity } from '../lib/engine.mjs';
import { boxInsideZone, estimatedHeightMm, nutritionSanityFacts, textHasVisualAllergenCue } from '../lib/prepress.mjs';
import { reviewSealProof, sealReview, verifyPortableSealProof, verifyReviewSeal } from '../lib/audit-signature.mjs';
import { marketFindings } from '../lib/market-presets.mjs';
import { canonicalGtin, hasValidGtinCheckDigit, suppliedGtinCandidates } from '../lib/gtin.mjs';
import { signalFindings } from '../lib/signals.mjs';

function gtinFromPrefix(prefix){
  const body=String(prefix);let sum=0,weight=3;
  for(let index=body.length-1;index>=0;index--){sum+=Number(body[index])*weight;weight=weight===3?1:3;}
  return body+String((10-(sum%10))%10);
}

test('validates GTIN-8, GTIN-12, GTIN-13 and GTIN-14 check digits and normalizes equivalent zero padding',()=>{
  for(const value of ['96385074','036000291452','4006381333931','10012345000017'])assert.equal(hasValidGtinCheckDigit(value),true,value);
  assert.equal(hasValidGtinCheckDigit('4006381333932'),false);
  assert.equal(hasValidGtinCheckDigit('1234567'),false);
  assert.equal(canonicalGtin('036000291452'),canonicalGtin('00036000291452'));
});

test('finds explicit product-record GTIN fields and labeled spreadsheet identifiers only',()=>{
  const spec={id:'spec',name:'product.json',role:'spec',data:{product:{gtin:'036000291452',sku:'123456789012'}},lines:[],cells:[]};
  const candidates=suppliedGtinCandidates([spec]);
  assert.deepEqual(candidates.map(item=>item.value),['036000291452']);
  const table={id:'table',name:'catalog.xlsx',role:'spec',data:null,lines:[],cells:[
    {sheet:'Catalog',cell:'A1',row:1,col:1,value:'Product'},
    {sheet:'Catalog',cell:'B1',row:1,col:2,value:'GTIN-13'},
    {sheet:'Catalog',cell:'A2',row:2,col:1,value:'Oat drink'},
    {sheet:'Catalog',cell:'B2',row:2,col:2,value:'4006381333931'},
  ]};
  assert.ok(suppliedGtinCandidates([table]).some(item=>item.value==='4006381333931'&&item.location==='Catalog!B2'));
  const numeric={id:'numeric',name:'numeric.xlsx',role:'spec',data:null,lines:[],cells:[
    {sheet:'Catalog',cell:'A1',row:1,col:1,value:'UPC'},
    {sheet:'Catalog',cell:'A2',row:2,col:1,value:36000291452,numberFormat:'000000000000'},
  ]};
  assert.ok(suppliedGtinCandidates([numeric]).some(item=>item.value==='036000291452'));
});

test('matches a valid decoded GTIN to an explicitly supplied product record and retains human checks',()=>{
  const gtin='036000291452';
  const review={documents:[
    {id:'art',name:'artwork.pdf',role:'artwork',text:'',pages:[{number:1,codes:[{format:'UPCA',gtin,box:[.2,.3,.4,.5]}]}]},
    {id:'spec',name:'product.json',role:'spec',data:{product:{gtin}},lines:[],cells:[]},
  ]};
  const findings=signalFindings(review);
  const match=findings.find(item=>item.method==='gtin_record_check');
  assert.equal(match.status,'match');
  assert.match(match.explanation,/print quality, legal acceptability/);
  assert.equal(findings.find(item=>item.method==='barcode_human_review').status,'review');
});

test('flags invalid decoded check digits and valid product-record mismatches',()=>{
  const makeReview=(decoded,source)=>({documents:[
    {id:'art',name:'artwork.pdf',role:'artwork',text:'',pages:[{number:1,codes:[{format:'EAN13',gtin:decoded}]}]},
    {id:'spec',name:'product.json',role:'spec',data:{product:{ean:source}},lines:[],cells:[]},
  ]});
  const invalid=signalFindings(makeReview('4006381333932','4006381333931')).find(item=>item.method==='gtin_record_check');
  assert.equal(invalid.status,'issue');
  assert.match(invalid.title,/invalid check digit/i);
  const mismatch=signalFindings(makeReview('4006381333931',gtinFromPrefix('400638133394'))).find(item=>item.method==='gtin_record_check');
  assert.equal(mismatch.status,'issue');
  assert.equal(mismatch.title,'Decoded GTIN differs from product record');
});

test('keeps missing or conflicting product GTINs in human review and does not imply print/legal approval',()=>{
  const review={documents:[
    {id:'art',name:'artwork.pdf',role:'artwork',text:'',pages:[{number:1,codes:[{format:'QRCode',gtin:'4006381333931'}]}]},
    {id:'spec',name:'product.json',role:'spec',data:{product:{gtin:gtinFromPrefix('400638133394'),barcode:gtinFromPrefix('400638133395')}},lines:[],cells:[]},
  ]};
  const findings=signalFindings(review);
  assert.equal(findings.find(item=>item.method==='gtin_record_check').status,'review');
  assert.equal(findings.find(item=>item.method==='barcode_human_review').status,'review');
});

test('converts kilograms to grams for package quantities', () => {
  assert.deepEqual(quantity('1.25 kg'), { value: 1250, dimension: 'mass' });
});

test('converts liters to milliliters for package quantities', () => {
  assert.deepEqual(quantity('1 L'), { value: 1000, dimension: 'volume' });
});

test('compares equivalent units and rejects mass-to-volume matches', () => {
  assert.equal(equalQuantity('1 L', '1000 mL'), true);
  assert.equal(equalQuantity('1 kg', '1000 mL'), false);
});

test('normalizes case, compatibility characters, and whitespace', () => {
  assert.equal(normal('FIELD DAY　Original'), normal('field day original'));
});

test('ignores AI facts that use fields outside the supported packaging checks', () => {
  const art={id:'art',name:'carton.pdf',role:'artwork',text:'NET QUANTITY: 750 mL\nFDA approved',lines:[
    {text:'NET QUANTITY: 750 mL',line:1,page:1,box:[.1,.1,.5,.2]},
    {text:'FDA approved',line:2,page:1,box:[.1,.3,.5,.4]},
  ],pages:[{number:1,width:1000,height:700,method:'pdf_text'}],cells:[]};
  const spec={id:'spec',name:'spec.txt',role:'spec',text:'Net quantity 750 mL\nFDA approved',lines:[],pages:[],cells:[]};
  const result=analyze({documents:[art,spec],ai:{facts:[
    {documentId:'spec',field:'net_quantity',value:'750 mL',quote:'Net quantity 750 mL'},
    {documentId:'spec',field:'legal_approval',value:'FDA approved',quote:'FDA approved'},
  ]},options:{},decisions:{},audit:[]});
  assert.ok(result.findings.some(item=>item.title==='Net quantity'));
  assert.ok(!result.findings.some(item=>item.title==='legal approval'));
});

test('routes a sibling-SKU variant mention to human review, not an automatic defect', () => {
  const art={id:'art',name:'carton.pdf',role:'artwork',text:'Original Oat Drink\nChocolate Crunch',lines:[{text:'Original Oat Drink',line:1,page:1,box:[.1,.1,.5,.2]},{text:'Chocolate Crunch',line:2,page:1,box:[.1,.3,.5,.4]}],pages:[{number:1,width:1000,height:700,method:'pdf_text'}],cells:[]};
  const first={id:'spec-a',name:'original.json',role:'spec',text:'Original SKU',lines:[],pages:[],cells:[],data:{product:{sku:'SKU-ORIGINAL',variant:'Original',name:'Oat Drink'}}};
  const sibling={id:'spec-b',name:'chocolate.json',role:'spec',text:'Chocolate SKU',lines:[],pages:[],cells:[],data:{product:{sku:'SKU-CHOCOLATE',variant:'Chocolate Crunch',name:'Oat Drink'}}};
  const selected=extractFacts(first).find(fact=>fact.field==='variant').id;
  const result=analyze({documents:[art,first,sibling],options:{completeArtwork:false,factChoices:{variant:selected}},decisions:{},audit:[]});
  const finding=result.findings.find(item=>item.method==='cross_sku_review');
  assert.ok(finding);
  assert.equal(finding.status,'review');
  assert.equal(finding.observed,'Chocolate Crunch appears in the artwork');
  assert.equal(finding.evidence.filter(item=>item.role==='artwork').length,1);
});

test('screens a tabular SKU family for sibling allergen and barcode carryover with cell evidence', () => {
  const cells=[
    ['SKU',1,1],['Variant',1,2],['Net Quantity',1,3],['Allergen Statement',1,4],['UPC',1,5],
    ['DF-BERRY-01',2,1],['Berry Crunch',2,2],['480 g',2,3],['Contains almonds',2,4],['1 20000 00003 6',2,5],
    ['DF-CHOCO-02',3,1],['Chocolate Almond',3,2],['500 g',3,3],['Contains hazelnuts',3,4],['1 20000 00004 3',3,5],
  ].map(([value,row,col])=>({sheet:'SKU family',cell:`${String.fromCharCode(64+col)}${row}`,row,col,value}));
  const art={id:'art',name:'berry-carton.pdf',role:'artwork',text:'Berry Crunch\n500 g\nContains hazelnuts\nNET 500 g\nUPC 1 20000 00004 3',lines:[
    {text:'Berry Crunch',line:1,page:1,box:[.1,.1,.5,.2]},
    {text:'Contains hazelnuts',line:2,page:1,box:[.1,.5,.7,.55]},
    {text:'NET 500 g',line:3,page:1,box:[.1,.8,.4,.85]},
    {text:'UPC 1 20000 00004 3',line:4,page:1,box:[.6,.8,.9,.85]},
  ],pages:[{number:1,width:1000,height:700,method:'pdf_text'}],cells:[]};
  const catalog={id:'catalog',name:'SKU-family.xlsx',role:'spec',text:'SKU family catalog',lines:[],pages:[],cells};
  const result=analyze({documents:[art,catalog],options:{completeArtwork:false},decisions:{},audit:[]});
  const finding=result.findings.find(item=>item.method==='cross_sku_catalog_review');
  assert.ok(finding);
  assert.equal(finding.status,'review');
  assert.match(finding.observed,/Chocolate Almond row content detected/);
  assert.match(finding.observed,/Contains hazelnuts/);
  assert.match(finding.observed,/1 20000 00004 3/);
  assert.ok(finding.evidence.some(item=>item.role==='spec'&&item.location==='SKU family!D3'));
  assert.ok(finding.evidence.some(item=>item.role==='artwork'&&item.page===1));
  assert.doesNotMatch(finding.explanation,/illegal|violation/);
});

test('environmental claims stay human review unless their evidence is inspected', () => {
  const art={id:'art',name:'carton.pdf',role:'artwork',text:'100% recyclable packaging',lines:[{text:'100% recyclable packaging',page:1,box:[.1,.1,.5,.2]}],pages:[{number:1,width:1000,height:700,method:'pdf_text'}],cells:[]};
  const claims={id:'claims',name:'claims-register.json',role:'claims',text:'No matching environmental substantiation.',lines:[],pages:[],cells:[],data:{entries:[]}};
  const result=analyze({documents:[art,claims],options:{completeArtwork:false},decisions:{},audit:[]});
  const finding=result.findings.find(item=>item.method==='environmental_claim_review');
  assert.ok(finding);
  assert.equal(finding.status,'review');
  assert.equal(finding.observed,'100% recyclable');
  assert.match(finding.explanation,/No claim-specific substantiation reference/);
  assert.match(finding.explanation,/not a finding that the claim is false or unlawful/);
  assert.equal(finding.evidence.find(item=>item.role==='artwork').page,1);
});

test('a recorded environmental reference remains a human verification prompt', () => {
  const art={id:'art',name:'carton.pdf',role:'artwork',text:'Compostable carton',lines:[{text:'Compostable carton',page:1,box:[.1,.1,.5,.2]}],pages:[{number:1,width:1000,height:700,method:'pdf_text'}],cells:[]};
  const claims={id:'claims',name:'claims-register.json',role:'claims',text:'Compostable',lines:[],pages:[],cells:[],data:{entries:[{claim_id:'C-1',text:'Compostable',status:'listed',evidence_reference:'LAB-REPORT-12'}]}};
  const finding=analyze({documents:[art,claims],options:{},decisions:{},audit:[]}).findings.find(item=>item.method==='environmental_claim_review');
  assert.equal(finding.status,'review');
  assert.match(finding.explanation,/LAB-REPORT-12/);
  assert.match(finding.explanation,/confirm that it substantiates this exact claim/);
  assert.ok(finding.evidence.some(item=>item.role==='claims'));
});

test('environmental signals include naturalness and ocean-plastic wording',()=>{
  const art={id:'art',name:'carton.pdf',role:'artwork',text:'100% Natural. Made with Ocean Plastic.',lines:[],pages:[{number:1,width:1000,height:700,method:'pdf_text'}],cells:[]};
  const claims={id:'claims',name:'claims-register.json',role:'claims',text:'',lines:[],pages:[],cells:[],data:{entries:[]}};
  const findings=analyze({documents:[art,claims],options:{},decisions:{},audit:[]}).findings.filter(item=>item.method==='environmental_claim_review');
  assert.deepEqual(findings.map(item=>item.observed).sort(),['100% Natural','Ocean Plastic']);
  assert.ok(findings.every(item=>item.status==='review'));
});

test('paired approved bilingual copy is compared exactly with source and artwork evidence',()=>{
  const art={id:'art',name:'bilingual-carton.pdf',role:'artwork',text:'Contains almonds\nContient des amandes',lines:[
    {text:'Contains almonds',page:1,box:[.1,.1,.5,.2]},
    {text:'Contient des amandes',page:1,box:[.1,.2,.6,.3]},
  ],pages:[{number:1,width:1000,height:700,method:'pdf_text'}],cells:[]};
  const spec={id:'spec',name:'approved-copy.json',role:'spec',text:'Approved English and French allergen copy.',lines:[],pages:[],cells:[],data:{translation_pairs:[
    {id:'almond-warning',required:true,status:'APPROVED',translations:{en:'Contains almonds',fr:'Contient des amandes'}},
  ]}};
  const finding=analyze({documents:[art,spec],options:{sourceConfirmed:true,completeArtwork:true},decisions:{},audit:[]}).findings.find(item=>item.method==='translation_pair_exact_copy');
  assert.equal(finding.status,'match');
  assert.match(finding.expected,/English: Contains almonds/);
  assert.match(finding.expected,/French: Contient des amandes/);
  assert.ok(finding.evidence.some(item=>item.role==='spec'&&item.location==='translation_pairs.almond-warning.translations.fr'));
  assert.equal(finding.evidence.filter(item=>item.role==='artwork').length,2);
  assert.match(finding.explanation,/does not assess whether translations have equivalent legal meaning/);
});

test('missing paired-language copy stays unverified until source and artwork coverage are confirmed',()=>{
  const art={id:'art',name:'bilingual-carton.pdf',role:'artwork',text:'Contains almonds',lines:[{text:'Contains almonds',page:1,box:[.1,.1,.5,.2]}],pages:[{number:1,width:1000,height:700,method:'pdf_text'}],cells:[]};
  const spec={id:'spec',name:'approved-copy.json',role:'spec',text:'Approved English and French allergen copy.',lines:[],pages:[],cells:[],data:{translation_pairs:[
    {id:'almond-warning',required:true,status:'APPROVED',translations:{en:'Contains almonds',fr:'Contient des amandes'}},
  ]}};
  const review=options=>analyze({documents:[art,spec],options,decisions:{},audit:[]}).findings.find(item=>item.method==='translation_pair_exact_copy');
  assert.equal(review({}).status,'unable');
  assert.equal(review({completeArtwork:true}).status,'review');
  const confirmed=review({completeArtwork:true,sourceConfirmed:true});
  assert.equal(confirmed.status,'issue');
  assert.match(confirmed.explanation,/not found in the inspected artwork text/);
});

test('unapproved translation pair can never be promoted to match or issue by broad source confirmation',()=>{
  const art={id:'art',name:'bilingual-carton.pdf',role:'artwork',text:'Contains almonds',lines:[],pages:[{number:1,width:1000,height:700,method:'pdf_text'}],cells:[]};
  const spec={id:'spec',name:'draft-copy.json',role:'spec',text:'Draft bilingual copy.',lines:[],pages:[],cells:[],data:{translation_pairs:[
    {id:'almond-warning',required:true,status:'DRAFT',translations:{en:'Contains almonds',fr:'Contient des amandes'}},
  ]}};
  const finding=analyze({documents:[art,spec],options:{completeArtwork:true,sourceConfirmed:true},decisions:{},audit:[]}).findings.find(item=>item.method==='translation_pair_exact_copy');
  assert.equal(finding.status,'review');
  assert.match(finding.explanation,/not marked APPROVED/);
});

test('all market preset text cues match their starter patterns',()=>{
  const artwork={id:'art',name:'label.pdf',role:'artwork',text:[
    'Nutrition Facts','Ingredients: oats','Contains almonds','Distributed by Sample Foods LLC',
    'FSSAI License No: 12345678901234','Vegetarian','Net quantity: 250 g','Best Before 2027',
    'Nutrition declaration energy 12 kJ','Store in a cool dry place',
  ].join('\n'),lines:[],pages:[{number:1,method:'pdf_text'}]};
  const titles=Object.fromEntries(['us','india','eu'].map(preset=>[
    preset,marketFindings({documents:[artwork],options:{marketPreset:preset}}),
  ]));
  for(const preset of ['us','india','eu']){
    assert.ok(titles[preset].length>=4);
    assert.ok(titles[preset].every(item=>!item.observed.startsWith('No matching text cue')),preset+' preset should recognize each supplied cue');
  }
});

test('an image transcription miss creates a visibility review instead of proving absence', () => {
  const art={id:'art',name:'carton.pdf',role:'artwork',text:'Store in a cool place.',lines:[{text:'Store in a cool place.',line:1,page:1,box:[.2,.2,.8,.3]}],pages:[{number:1,width:1000,height:700,method:'pdf_text',visualText:'Fieldday Oat Drink'}],cells:[]};
  const spec={id:'spec',name:'approved.json',role:'spec',text:'Refrigerate after opening.',lines:[],pages:[],cells:[],data:{product:{storage_statement:'Refrigerate after opening.'}}};
  const result=analyze({documents:[art,spec],options:{completeArtwork:true,sourceConfirmed:true},decisions:{},audit:[]});
  const check=result.findings.find(item=>item.rule?.field==='storage_statement'&&item.method==='exact_comparison');
  const visibility=result.findings.find(item=>item.method==='visibility_review');
  assert.equal(check.status,'issue');
  assert.equal(check.visibility.state,'needs_human_review');
  assert.equal(visibility.status,'review');
  assert.match(visibility.explanation,/not proof that the text is invisible/);
});

test('matches exact multi-sentence copy across PDF line wraps without accepting stale or negated copy', () => {
  const expected='Store in a cool, dry place. Once opened, keep packaging closed and eat within a month or by date shown, for best before, see base of pack.';
  const spec={id:'spec',name:'approved.json',role:'spec',text:expected,lines:[],pages:[],cells:[],data:{product:{storage_statement:expected}}};
  const analyzeArtwork=text=>{
    const art={id:'art',name:'carton.pdf',role:'artwork',text,lines:[{text,line:1,page:1,box:[.1,.7,.9,.8]}],pages:[{number:1,width:1000,height:700,method:'pdf_text'}],cells:[]};
    const result=analyze({documents:[art,spec],options:{completeArtwork:false,sourceConfirmed:true},decisions:{},audit:[]});
    return result.findings.find(item=>item.rule?.field==='storage_statement');
  };
  const matched=analyzeArtwork('Store in a cool, dry place. Once\r\nopened, keep packaging closed and eat within a month or by date shown,\r\nfor best before, see base of pack.');
  assert.equal(matched.status,'match');

  const stale=analyzeArtwork(`Previous version. ${expected}`);
  assert.equal(stale.status,'review');

  const negated=analyzeArtwork(`Do not ${expected}`);
  assert.equal(negated.status,'issue');
  assert.match(negated.explanation,/negated instruction/);
});

test('identifies a resolved finding between artwork revisions', () => {
  const result = compareRevisions(
    { id: 'v1', findings: [{ id: 'quantity', title: 'Net quantity', status: 'issue' }] },
    { id: 'v2', findings: [{ id: 'quantity', title: 'Net quantity', status: 'match' }] },
  );
  assert.equal(result.changes[0].change, 'resolved');
});

test('identifies a new issue introduced in a revision', () => {
  const result = compareRevisions(
    { id: 'v1', findings: [{ id: 'contact', title: 'Contact', status: 'match' }] },
    { id: 'v2', findings: [{ id: 'contact', title: 'Contact', status: 'issue' }] },
  );
  assert.equal(result.changes[0].change, 'new_issue');
});

test('source revision comparison traces changed values, checklist requirements, findings, and prior decisions', () => {
  const documents = (specHash, ruleHash) => [
    { id: 'art', name: 'carton.pdf', role: 'artwork', sha256: 'a'.repeat(64) },
    { id: 'spec', name: 'product-spec.json', role: 'spec', sha256: specHash },
    { id: 'rules', name: 'company-checklist.json', role: 'rules', sha256: ruleHash },
    { id: 'claims', name: 'claims.json', role: 'claims', sha256: 'c'.repeat(64) },
  ];
  const previous = {
    id: 'source-v1', documents: documents('b'.repeat(64), 'd'.repeat(64)),
    facts: [{ documentId: 'spec', field: 'net_quantity', label: 'Net quantity', value: '750 mL', evidence: { documentId: 'spec', name: 'product-spec.json', location: 'product.net_quantity' } }],
    rules: [{ id: 'rules:quantity', title: 'Net quantity', text: 'The artwork must show 750 mL.', source: { documentId: 'rules', location: 'net-quantity' } }],
    findings: [
      { id: 'quantity-check', key: 'rule:quantity', title: 'Net quantity', status: 'issue', evidence: [{ documentId: 'art', role: 'artwork' }, { documentId: 'spec', role: 'spec' }, { documentId: 'rules', role: 'rules' }] },
      { id: 'claim-check', key: 'claims', title: 'Claim substantiation', status: 'review', evidence: [{ documentId: 'claims', role: 'claims' }] },
    ],
    decisions: {
      'quantity-check': { disposition: 'needs_changes', note: 'Update pack quantity.' },
      'claim-check': { disposition: 'acknowledged', note: 'Evidence reviewed.' },
    },
  };
  const current = {
    id: 'source-v2', revisionKind: 'sources', documents: documents('e'.repeat(64), 'f'.repeat(64)),
    facts: [{ documentId: 'spec', field: 'net_quantity', label: 'Net quantity', value: '1000 mL', evidence: { documentId: 'spec', name: 'product-spec.json', location: 'product.net_quantity' } }],
    rules: [{ id: 'rules:quantity', title: 'Net quantity', text: 'The artwork must show 1000 mL.', source: { documentId: 'rules', location: 'net-quantity' } }],
    findings: [
      { id: 'quantity-check', key: 'rule:quantity', title: 'Net quantity', status: 'match', evidence: [{ documentId: 'art', role: 'artwork' }, { documentId: 'spec', role: 'spec' }, { documentId: 'rules', role: 'rules' }] },
      { id: 'claim-check', key: 'claims', title: 'Claim substantiation', status: 'review', evidence: [{ documentId: 'claims', role: 'claims' }] },
    ],
  };
  const result = compareRevisions(previous, current);
  assert.equal(result.kind, 'sources');
  assert.deepEqual(result.sourceDocuments.map(item => item.role).sort(), ['rules', 'spec']);
  assert.deepEqual(result.changedFacts.map(item => [item.label, item.before[0].value, item.after[0].value]), [['Net quantity', '750 mL', '1000 mL']]);
  assert.deepEqual(result.changedRequirements.map(item => [item.change, item.before.text, item.after.text]), [['updated', 'The artwork must show 750 mL.', 'The artwork must show 1000 mL.']]);
  assert.deepEqual(result.affectedFindings.map(item => item.id), ['quantity-check']);
  assert.deepEqual(result.decisionRechecks.map(item => [item.findingId, item.currentFindingId, item.disposition]), [['quantity-check', 'quantity-check', 'needs_changes']]);
  assert.equal(result.changes.find(item => item.id === 'quantity-check').change, 'resolved');
});

test('measures an extracted text box in millimeters', () => {
  assert.ok(Math.abs(estimatedHeightMm({ height: 720 }, [0, 0.9, 1, 0.91]) - 2.54) < 0.000001);
});

test('checks a located text center against a reviewer panel zone', () => {
  assert.equal(boxInsideZone([0.2, 0.2, 0.3, 0.3], [0.1, 0.1, 0.5, 0.5]), true);
  assert.equal(boxInsideZone([0.7, 0.7, 0.8, 0.8], [0.1, 0.1, 0.5, 0.5]), false);
});

test('panel evidence prefers the matching text inside the mapped panel when artwork repeats it elsewhere', () => {
  const art={id:'art',name:'baseline.pdf',role:'artwork',text:'PACKSIGNAL / ORIGINAL SYNTHETIC ARTWORK\nOriginal',lines:[
    {text:'PACKSIGNAL / ORIGINAL SYNTHETIC ARTWORK',page:1,box:[.03,.02,.97,.04]},
    {text:'Original',page:1,box:[.198,.313,.260,.337]},
  ],pages:[{number:1,width:1200,height:860,method:'pdf_text'}],cells:[]};
  const spec={id:'spec',name:'product.json',role:'spec',text:'Original',lines:[],pages:[],cells:[],data:{product:{variant:'Original'}}};
  const rules={id:'rules',name:'rules.json',role:'rules',text:'The front panel must display Original.',lines:[],pages:[],cells:[],data:{rules:[{id:'variant',title:'Variant',panel:'front',field:'variant',comparison:'exact_phrase',literal_expected:'Original',rule_text:'The front panel must display Original.'}]}};
  const result=analyze({documents:[art,spec,rules],options:{panelZones:{front:{page:1,box:[.033,.07,.425,.933]}}},decisions:{},audit:[]});
  const placement=result.findings.find(item=>item.method==='panel_geometry');
  assert.equal(placement?.status,'match');
  assert.deepEqual(placement.evidence.find(item=>item.role==='artwork')?.box,[.198,.313,.260,.337]);
});

test('flags nutritional values that fail the internal calorie screen', () => {
  const facts = [
    { field: 'nutrition.energy_kcal', value: '90 kcal' },
    { field: 'nutrition.protein_g', value: '1 g' },
    { field: 'nutrition.carbohydrate_g', value: '5 g' },
    { field: 'nutrition.fat_g', value: '1 g' },
  ];
  const result = nutritionSanityFacts(facts).find(item => item.type === 'atwater');
  assert.equal(result.passes, false);
});

test('recognizes a clear uppercase allergen cue for reviewer screening', () => {
  assert.equal(textHasVisualAllergenCue('INGREDIENTS: OATS. CONTAINS: OATS.', 'Contains oats.').hasCue, true);
  assert.equal(textHasVisualAllergenCue('Ingredients: oats.', 'Contains oats.').hasCue, false);
});

test('seals review evidence and detects later edits', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'packproof-seal-'));
  try {
    const review = { id: 'review-1', createdAt: '2026-10-17T00:00:00.000Z', name: 'Example', documents: [{ id: 'source-1', role: 'artwork', name: 'art.pdf', sha256: 'abc' }], findings: [{ id: 'finding-1', status: 'issue', expected: '1000 mL', observed: '750 mL', evidence: [] }], audit: [], decisions: {} };
    review.signature = await sealReview(review, directory);
    assert.equal((await verifyReviewSeal(review, directory)).valid, true);
    assert.equal(verifyPortableSealProof({ ...reviewSealProof(review), ...review.signature }).valid, true);
    review.decisions['finding-1'] = { disposition: 'needs_changes', note: 'Update artwork' };
    assert.equal((await verifyReviewSeal(review, directory)).valid, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
