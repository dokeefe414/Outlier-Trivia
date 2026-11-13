// Open Answer Atlas v1.5 — finite, source-backed large answer sets.
// These additions are unranked / practice-only until a new official UTC
// weekly slate is intentionally versioned, avoiding midweek score disputes.
// Source: Corpora CC0 archived data. See docs/OPEN_ANSWER_ATLAS.md.
import {placeAtlasSnapshot} from "./open-atlas-snapshot.js";
import {normalizeAnswer} from "./answer-intelligence.js";

const abbreviations=Object.fromEntries(
  ("Alabama:AL|Alaska:AK|Arizona:AZ|Arkansas:AR|California:CA|Colorado:CO|"+
   "Connecticut:CT|Delaware:DE|District of Columbia:DC|Florida:FL|Georgia:GA|"+
   "Hawaii:HI|Idaho:ID|Illinois:IL|Indiana:IN|Iowa:IA|Kansas:KS|Kentucky:KY|"+
   "Louisiana:LA|Maine:ME|Maryland:MD|Massachusetts:MA|Michigan:MI|"+
   "Minnesota:MN|Mississippi:MS|Missouri:MO|Montana:MT|Nebraska:NE|Nevada:NV|"+
   "New Hampshire:NH|New Jersey:NJ|New Mexico:NM|New York:NY|North Carolina:NC|"+
   "North Dakota:ND|Ohio:OH|Oklahoma:OK|Oregon:OR|Pennsylvania:PA|"+
   "Rhode Island:RI|South Carolina:SC|South Dakota:SD|Tennessee:TN|Texas:TX|"+
   "Utah:UT|Vermont:VT|Virginia:VA|Washington:WA|West Virginia:WV|"+
   "Wisconsin:WI|Wyoming:WY").split("|").map(text=>text.split(":"))
);
const norm=normalizeAnswer;
const stateNames=Object.fromEntries(Object.entries(abbreviations).map(([state,abbr])=>[abbr,state]));
const countyBaseName=name=>String(name).replace(/ (County|Parish|Census Area|Municipality|Borough|City and Borough|City)$/i,"").trim();
const counts=values=>{
  const map=new Map();
  for(const value of values){const key=norm(value);map.set(key,(map.get(key)||0)+1);}
  return map;
};

const cities=placeAtlasSnapshot.cities.map(([city,state,population],index)=>({
  city,state,population,index,label:city+", "+state
}));
const cityNames=counts(cities.map(row=>row.city));
const counties=placeAtlasSnapshot.counties.map(([county,abbr])=>({
  county,short:countyBaseName(county),state:stateNames[abbr]||abbr,abbr,
  label:county+", "+(stateNames[abbr]||abbr)
}));
const countyNames=counts(counties.map(row=>row.short));
const famousDinos=new Map([
  ["Tyrannosaurus",120],["Triceratops",150],["Velociraptor",170],
  ["Stegosaurus",160],["Brachiosaurus",190],["Diplodocus",270],
  ["Allosaurus",310],["Ankylosaurus",250],["Spinosaurus",290],
  ["Iguanodon",380],["Brontosaurus",220],["Apatosaurus",390]
]);
const am=s=>/^[a-m]/i.test(s);
const nz=s=>/^[n-z]/i.test(s);
const long=s=>String(s).replace(/[^a-z]/gi,"").length>=10;

// This function intentionally refuses ambiguous unqualified place names.
// It also checks proposed aliases against ALL canonical entries in the prompt.
// For example, "Springfield" alone must never arbitrarily mean one state.
export function makeSourceQuestion({id,category,group,prompt,records,name,score,alias,filter=()=>true,source}) {
  const subset=records.filter(filter);
  const seen=new Set();
  const entries=[];
  for(const item of subset){
    const label=name(item).trim(),key=norm(label);
    if(!key||seen.has(key))continue;
    seen.add(key);
    const points=score(item);
    if(!Number.isInteger(points)||points<1||points>1000)throw new Error("Invalid atlas score for "+label);
    entries.push({label,key,points,candidates:alias(item)});
  }
  const canonical=new Set(entries.map(e=>e.key));
  const owners=new Map();
  for(const entry of entries){
    for(const candidate of entry.candidates){
      const key=norm(candidate);
      if(!key||key===entry.key)continue;
      if(!owners.has(key))owners.set(key,new Set());
      owners.get(key).add(entry.key);
    }
  }
  const answers=entries.map(entry=>{
    const seenAlias=new Set(),aliases=[];
    for(const name of entry.candidates){
      const key=norm(name);
      if(!key||key===entry.key||canonical.has(key)||
          owners.get(key)?.size!==1||seenAlias.has(key))continue;
      seenAlias.add(key);aliases.push(name);
    }
    return [entry.label,entry.points,aliases];
  });
  if(answers.length<28)throw new Error("Insufficient verified source rows: "+id);
  return {id:"open-"+id,bigPool:true,arcadeOnly:true,poolGroup:group,category,prompt,
    detail:answers.length+" accepted entries from "+source+". For shared names, include the state. Editorial rarity estimates, not actual survey counts.",
    answers};
}
const sourceCities="archived 2016 U.S. city-population collection";
const sourceCounties="archived Census-derived U.S. county FIPS list";
const sourceDinos="archived CC0 dinosaur-name catalog";
const cityAliases=row=>{
  const list=[row.city+", "+(abbreviations[row.state]||row.state)];
  if(cityNames.get(norm(row.city))===1)list.push(row.city);
  return list;
};
const countyAliases=row=>{
  const list=[row.county+", "+row.abbr,
    row.short+", "+row.state,row.short+", "+row.abbr];
  if(countyNames.get(norm(row.short))===1)list.push(row.county,row.short);
  return list;
};
// Population is only a broad editorial notability proxy (2016), NOT how
// frequently players choose an answer; published scoring is immutable.
const cityScore=row=>row.index<20?150:row.index<100?340:
  row.index<300?520:row.index<650?720:900;
const countyScore=row=>{
  const familiar=/^(cook|orange|king|los angeles|miami-dade|queens|harris|fulton|suffolk|maricopa)$/i;
  return familiar.test(row.short)?340:row.short.length<7?610:
    row.short.length<12?770:920;
};
const dinosaurScore=name=>famousDinos.get(name)||
  (String(name).length<9?650:String(name).length<14?810:940);

const questions=[];
function add(options){questions.push(makeSourceQuestion(options));}
const cityBase={category:"GEOGRAPHY",group:"geo",records:cities,name:x=>x.label,
  score:cityScore,alias:cityAliases,source:sourceCities};
add({...cityBase,id:"us-city-top1000",prompt:"Name a U.S. city in our archived top-1,000 by 2016 population estimates. Include its state if the city name is shared."});
add({...cityBase,id:"us-city-am",prompt:"Name a U.S. city beginning A–M in our archived top-1,000 cities (2016).",filter:x=>am(x.city)});
add({...cityBase,id:"us-city-nz",prompt:"Name a U.S. city beginning N–Z in our archived top-1,000 cities (2016).",filter:x=>nz(x.city)});
add({...cityBase,id:"us-city-long",prompt:"Name a U.S. city with at least ten letters in its city name from our archived top-1,000 cities (2016).",filter:x=>long(x.city)});
for(const state of ["California","Texas","Florida"]){
  add({...cityBase,id:"us-city-"+abbreviations[state].toLowerCase(),
    prompt:"Name a city in "+state+" from our archived 2016 top-1,000 U.S. city list.",
    filter:x=>x.state===state});
}

const countyBase={category:"GEOGRAPHY",group:"geo",records:counties,name:x=>x.label,
  score:countyScore,alias:countyAliases,source:sourceCounties};
add({...countyBase,id:"us-county-all",prompt:"Name a U.S. county or county-equivalent division from our archived Census-derived FIPS list. Add the state if the name is shared."});
add({...countyBase,id:"us-county-am",prompt:"Name a U.S. county or county-equivalent beginning A–M in our archived FIPS list.",filter:x=>am(x.short)});
add({...countyBase,id:"us-county-nz",prompt:"Name a U.S. county or county-equivalent beginning N–Z in our archived FIPS list.",filter:x=>nz(x.short)});
add({...countyBase,id:"us-county-long",prompt:"Name a U.S. county or county-equivalent with ten or more letters in its name from our archived FIPS list.",filter:x=>long(x.short)});
for(const state of ["Texas","California","Pennsylvania"]){
  add({...countyBase,id:"us-county-"+abbreviations[state].toLowerCase(),
    prompt:"Name a county in "+state+" from our archived county list.",
    filter:x=>x.state===state});
}

const dinoBase={category:"DINOSAURS",group:"animals",
  records:placeAtlasSnapshot.dinosaurs,
  name:x=>x,score:dinosaurScore,alias:()=>[],source:sourceDinos};
add({...dinoBase,id:"dinosaur-names",prompt:"Name a dinosaur or dinosaur group from our archived 1,449-name reference list."});
add({...dinoBase,id:"dinosaur-am",prompt:"Name a dinosaur or dinosaur group beginning A–M from our archived reference list.",filter:am});
add({...dinoBase,id:"dinosaur-nz",prompt:"Name a dinosaur or dinosaur group beginning N–Z from our archived reference list.",filter:nz});
add({...dinoBase,id:"dinosaur-long",prompt:"Name a dinosaur or dinosaur group with at least ten letters from our archived reference list.",filter:long});
export const openAtlasQuestions=questions;
export const openAtlasCatalog=Object.freeze({
  sourceEntries:cities.length+counties.length+placeAtlasSnapshot.dinosaurs.length,
  cityEntries:cities.length,countyEntries:counties.length,
  dinosaurEntries:placeAtlasSnapshot.dinosaurs.length,
  prompts:questions.length,
  answerSlots:questions.reduce((n,q)=>n+q.answers.length,0)
});
