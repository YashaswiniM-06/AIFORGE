import { createHash } from 'node:crypto';
import { evidence, safeCopyMatch } from './engine.mjs';
const id=s=>createHash('sha256').update(s).digest('hex').slice(0,14);
const languageSignals=[
  ['Spanish',['ingredientes','conservar','contenido neto','consumir preferentemente']],
  ['French',['ingrédients','à conserver','à consommer','voir emballage']],
  ['Hindi',['सामग्री','भंडारण','शुद्ध मात्रा','उपयोग करें']],
  ['Arabic',['المكونات','يحفظ','الوزن الصافي','يفضل استخدام']],
];
const environmentalClaimPatterns=[
  ['Eco-friendly packaging',/\b(?:eco[ -]?friendly|environmentally friendly)\b/ig],
  ['Carbon impact claim',/\bcarbon[- ]?(?:neutral|negative|positive)\b/ig],
  ['Compostability claim',/\b(?:home |industrially )?compostable\b/ig],
  ['Biodegradability claim',/\bbiodegradable\b/ig],
  ['Recyclability claim',/\b(?:100\s*%\s*)?recyclable\b/ig],
  ['Recycled-content claim',/\b(?:made with|contains)\s+\d{1,3}\s*%\s+recycled\s+(?:content|material|plastic|paper|board)\b/ig],
  ['Naturalness claim',/\b(?:100\s*%\s*(?:all[- ]?)?natural|all[- ]natural)\b/ig],
  ['Ocean-plastic claim',/\bocean[- ]?(?:bound )?plastic\b/ig],
  ['Sustainable-packaging claim',/\bsustainable packaging\b/ig],
  ['Zero-waste claim',/\bzero[- ]waste\b/ig],
];

function environmentalClaimFindings(review,art){
  const docs=review.documents||[],registers=docs.filter(doc=>doc.role==='claims');
  const output=[],seen=new Set();
  for(const [label,pattern] of environmentalClaimPatterns){
    pattern.lastIndex=0;
    for(const match of String(art.text||'').matchAll(pattern)){
      const quote=match[0].trim(),key=quote.toLocaleLowerCase();
      if(!quote||seen.has(key))continue;seen.add(key);
      const entry=registers.flatMap(doc=>(Array.isArray(doc.data?.entries)?doc.data.entries:[]).map(item=>({doc,item})))
        .find(({item})=>typeof item.text==='string'&&item.text.toLocaleLowerCase().includes(quote.toLocaleLowerCase()));
      const reference=entry&&['evidence_reference','substantiation','supporting_document','certification_reference']
        .map(field=>entry.item[field]).find(value=>typeof value==='string'&&value.trim());
      const artworkEvidence=evidence(art,quote);
      const sourceEvidence=entry?[evidence(entry.doc,entry.item.text,{location:`Claims register · ${entry.item.claim_id||entry.item.status||'entry'}`})]:[];
      const supportingEvidence=reference?[evidence(entry.doc,reference,{location:`Claims register · supporting reference`})]:[];
      const pages=(art.pages||[]).filter(page=>page.method==='ai_transcription'||page.method==='vision_needed');
      const support=reference
        ?`The supplied claims register lists a supporting reference (“${String(reference).slice(0,180)}”). A reviewer still needs to open it and confirm that it substantiates this exact claim, material, market and package.`
        :'No claim-specific substantiation reference was identified in the supplied files. Request and review supporting evidence before relying on the claim.';
      const visibility=pages.length?' Artwork visibility may also need visual confirmation.':'';
      output.push({
        id:id(`environmental-claim:${key}`),key:`environmental-claim:${key}`,
        title:`Environmental claim needs substantiation review`,status:'review',
        expected:'Claim-specific supporting evidence applicable to this exact claim and package.',
        observed:quote,
        explanation:`A packaging sustainability claim was detected (${label}). ${support} This is an evidence-gap prompt, not a finding that the claim is false or unlawful.${visibility}`,
        evidence:[...sourceEvidence,...supportingEvidence,artworkEvidence],
        rule:{text:'Reviewer prompt: inspect claim-specific substantiation supplied for this package. No universal certification requirement is inferred.'},
        severity:'minor',method:'environmental_claim_review',
      });
    }
  }
  return output;
}

const languageNames={en:'English',es:'Spanish',fr:'French',hi:'Hindi',ar:'Arabic'};
function translationParityFindings(review,art){
  const rows=(review.documents||[]).flatMap(doc=>
    (Array.isArray(doc.data?.translation_pairs)?doc.data.translation_pairs:[])
      .filter(pair=>pair&&pair.required===true&&pair.translations&&typeof pair.translations==='object')
      .map((pair,index)=>({doc,pair,index})));
  return rows.flatMap(({doc,pair,index})=>{
    const translations=Object.entries(pair.translations)
      .filter(([language,phrase])=>/^[a-z]{2}$/i.test(language)&&typeof phrase==='string'&&phrase.trim())
      .map(([language,phrase])=>({language:language.toLowerCase(),phrase:phrase.trim()}));
    if(translations.length<2)return [];
    const checked=translations.map(item=>({...item,found:safeCopyMatch(art.text,item.phrase)}));
    const missing=checked.filter(item=>!item.found);
    const sourceConfirmed=Boolean(review.options?.sourceConfirmed);
    const coverageConfirmed=Boolean(review.options?.completeArtwork);
    const pairApproved=String(pair.status||'').trim().toLocaleUpperCase()==='APPROVED';
    const authorityConfirmed=sourceConfirmed&&pairApproved;
    const status=missing.length
      ?coverageConfirmed?(authorityConfirmed?'issue':'review'):'unable'
      :authorityConfirmed?'match':'review';
    const identifier=String(pair.id||pair.message||index+1);
    const expected=translations.map(item=>(languageNames[item.language]||item.language.toUpperCase())+': '+item.phrase).join(' · ');
    const observed=checked.map(item=>(languageNames[item.language]||item.language.toUpperCase())+': '+(item.found?'exact supplied wording located':'exact supplied wording not located')).join(' · ');
    const sourceEvidence=translations.map(item=>evidence(doc,item.phrase,{location:'translation_pairs.'+identifier+'.translations.'+item.language}));
    const artworkEvidence=checked.filter(item=>item.found).map(item=>evidence(art,item.phrase));
    const explanation=missing.length
      ?coverageConfirmed
        ?authorityConfirmed
          ?'One or more required, source-supplied language versions were not found in the inspected artwork text. This is an exact-copy comparison against the supplied pair; a reviewer should inspect the cited regions and confirm the correction.'
          :'One or more language versions were not found, but the translation pair is not marked APPROVED and confirmed as authoritative.'
        :'One or more language versions were not found in extracted text. Confirm artwork coverage and inspect the relevant panels before treating this as an omission.'
      :authorityConfirmed
        ?'All supplied exact phrases were found. This verifies wording presence only; it does not assess whether translations have equivalent legal meaning.'
        :'All supplied exact phrases were found, but the pair is not marked APPROVED and confirmed as authoritative.';
    return [{
      id:id('translation-pair:'+doc.id+':'+identifier),key:'translation-pair:'+identifier,
      title:missing.length?'Required bilingual copy needs attention':'Bilingual copy pair check',
      status,expected,observed,explanation,
      evidence:[...sourceEvidence,...artworkEvidence],
      rule:{text:'Exact-copy parity check against reviewer-supplied paired wording. No machine translation or semantic equivalence decision is made.'},
      severity:'minor',method:'translation_pair_exact_copy',
    }];
  });
}

export function signalFindings(review){
  const art=review.documents?.find(d=>d.role==='artwork');if(!art)return [];
  const text=String(art.text||'').toLocaleLowerCase();const results=[];
  for(const [language,cues] of languageSignals){
    const matched=cues.filter(c=>text.includes(c));if(matched.length<2)continue;
    results.push({id:id(`language:${language}:${matched.join('|')}`),key:`language:${language}`,title:`${language} label text detected`,status:'review',expected:'An approved source and reviewer verification for the detected language content.',observed:matched.join(' · '),explanation:`Multiple ${language} packaging cues were detected. PackSignal did not verify translation equivalence, language applicability, typography, or approval.`,evidence:[evidence(art,matched[0])],rule:{text:'Language detection is a review signal, not translation validation.'},severity:'minor',method:'language_detection'});
  }
  const codes=(art.pages||[]).flatMap(page=>(page.codes||[]).map(code=>({page,code})));
  for(const {page,code} of codes){
    const type=String(code.format||'code').replace(/^BarcodeFormat\./,'');
    results.push({id:id(`code:${page.number}:${type}:${JSON.stringify(code.box||[])}`),key:`code:${page.number}:${type}`,title:`${type} detected on artwork`,status:'review',expected:'Human verification if a code is required for this distribution context.',observed:`${type} detected on page ${page.number}${code.box?' at an approximate location':''}.`,explanation:'The symbol was decoded only to establish its type and approximate location. PackSignal does not validate print grade, retail assignment, payload correctness, or destination safety.',evidence:[{documentId:art.id,name:art.name,role:'artwork',quote:`${type} detected`,page:page.number,box:code.box||null,location:`Page ${page.number}`}],rule:{text:'Code presence is a review signal; requirements and scan quality remain out of scope.'},severity:'minor',method:'barcode_detection'});
  }
  if(!codes.length)results.push({id:id('code:unverified'),key:'code:unverified',title:'Barcode or QR presence not verified',status:'unable',expected:'A scan result or visual reviewer confirmation when a code is relevant.',observed:'No locally decoded symbol.',explanation:'A lack of decoder output is not proof that the artwork has no barcode or QR code. The symbol may be unreadable, vector-only, truncated, or not required.',evidence:[],rule:{text:'Code scanning is optional and does not determine retail requirements.'},severity:'minor',method:'barcode_detection'});
  results.push(...environmentalClaimFindings(review,art));
  results.push(...translationParityFindings(review,art));
  return results;
}
