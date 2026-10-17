import { createHash } from 'node:crypto';
import { evidence } from './engine.mjs';
const id=s=>createHash('sha256').update(s).digest('hex').slice(0,14);
export const marketPresets=[
  {id:'none',label:'No market starter checklist'},
  {id:'us',label:'US - FDA label topics'},
  {id:'india',label:'India - FSSAI label topics'},
  {id:'eu',label:'EU - food information topics'}
];
const lists={
  us:{source:'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101',title:'US FDA starter topics',items:[['Nutrition Facts','nutrition\\s+facts'],['Ingredient declaration','ingredients?\\s*:'],['Allergen declaration','contains\\s+|allergen'],['Name and business address','(?:manufactured|distributed|packed)\\s+(?:by|for)|\\b(?:inc|llc|ltd)\\b']]},
  india:{source:'https://www.fssai.gov.in/cms/food-safety-and-standards-labelling-and-display-regulations.php',title:'India FSSAI starter topics',items:[['FSSAI licence number','fssai\\s*(?:licen[cs]e)?\\s*(?:no\\.?|number)?\\s*[:#]?\\s*\\d{5,}'],['Vegetarian or non-vegetarian declaration','(?:vegetarian|non[- ]?vegetarian|veg\\.?|non[- ]?veg)'],['Net quantity','(?:net\\s*(?:wt|weight|quantity)?|contents?)\\s*[:.]?\\s*\\d'],['Best-before or use-by declaration','(?:best\\s*before|use\\s*by|expiry|expires?)']]},
  eu:{source:'https://eur-lex.europa.eu/eli/reg/2011/1169/oj',title:'EU food information starter topics',items:[['Ingredient list','ingredients?\\s*:'],['Allergen emphasis needs visual review','contains\\s+|allergen'],['Nutrition declaration','nutrition(?:al)?\\s+(?:information|declaration)|energy\\s+\\d'],['Date or storage declaration','(?:best\\s*before|use\\s*by|store|refrigerate|keep)']]}
};
export function marketFindings(review){
  const preset=lists[review.options?.marketPreset];const art=review.documents?.find(d=>d.role==='artwork');if(!preset||!art)return [];
  const complete=Boolean(review.options?.completeArtwork)&&art.pages?.every(p=>p.method==='pdf_text');
  return preset.items.map(([title,pattern])=>{
    const match=art.text.match(new RegExp(pattern,'i'));const located=match?.[0]||'';
    const status=located?'review':complete?'review':'unable';
    return {id:id(`market:${preset.title}:${title}`),key:`market:${review.options.marketPreset}:${title}`,title:`${preset.title} - ${title}`,status,
      expected:'Reviewer to determine applicability and required form for the target product and market.',observed:located||'No matching text cue located in extracted artwork.',
      explanation:located?'A related text cue was detected. Verify the required content, applicability, placement and formatting with a qualified reviewer.':'No text cue was located. This starter checklist cannot establish that the item is required or missing; inspect the supplied artwork and applicable rules.',
      evidence:[evidence(art,located||title)],rule:{text:`Optional market starter topic: ${title}. This is not a complete legal ruleset.`,sourceURL:preset.source},severity:'minor',method:'market_starter_checklist'};
  });
}
