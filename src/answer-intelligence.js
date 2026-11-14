// OUTLIER Answer Intelligence v0.9
// Finite, verified library matching: exact names, explicitly approved aliases,
// Unicode-safe forms and single-edit, unambiguous typos. No generative guesses.
const cache = new WeakMap();
const folding = Object.freeze({
  "ß":"ss","ẞ":"ss","æ":"ae","Æ":"ae","œ":"oe","Œ":"oe",
  "ø":"o","Ø":"o","ł":"l","Ł":"l","đ":"d","Đ":"d",
  "ð":"d","Ð":"d","þ":"th","Þ":"th","ı":"i","ĸ":"k",
  "♀":"female","♂":"male","№":"number"
});

export function normalizeAnswer(value) {
  return String(value ?? "").trim()
    .replace(/[ßẞæÆœŒøØłŁđĐðÐþÞıĸ♀♂№]/g, char => folding[char])
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/&/g, " and ")
    .replace(/\+/g," plus ").replace(/#/g," sharp ")
    .replace(/[^a-z0-9]/g, "");
}

// A fast, bounded edit-distance 1 check (one insertion, deletion, replacement).
// Avoid quadratic cost when players test large 1,000-answer pools.
export function oneEditApart(a, b) {
  if (a===b || Math.abs(a.length-b.length)>1) return false;
  let i=0,j=0,edits=0;
  while(i<a.length && j<b.length) {
    if(a[i]===b[j]){i++;j++;continue;}
    if(++edits>1)return false;
    if(a.length>b.length)i++;
    else if(b.length>a.length)j++;
    else{i++;j++;}
  }
  return edits + (a.length-i)+(b.length-j) === 1;
}
// Indexed exact matches and one-deletion fingerprints scale to thousands
// of approved names. We validate each candidate with the strict one-edit
// checker before accepting it; never guess a new correct answer.
export function indexQuestion(question) {
  if(cache.has(question))return cache.get(question);
  const exact=new Map(),variants=[],seenVariants=new Set();
  for(const row of question.answers||[]) {
    const [label,points,aliases=[]]=row;
    for(const [position,raw] of [label,...aliases].entries()){
      const key=normalizeAnswer(raw);
      if(!key)continue;
      const entry={key,label,points,matchKind:position===0?"canonical":"alias"};
      if(!exact.has(key))exact.set(key,[]);
      if(!exact.get(key).some(x=>x.label===label))exact.get(key).push(entry);
      const signature=key+"\u0000"+label;
      if(!seenVariants.has(signature)){seenVariants.add(signature);variants.push(entry);}
    }
  }
  const deletes=new Map();
  for(const variant of variants){
    if(variant.key.length<4)continue;
    const seen=new Set();
    for(let i=0;i<variant.key.length;i++){
      const deletion=variant.key.slice(0,i)+variant.key.slice(i+1);
      if(seen.has(deletion))continue;
      seen.add(deletion);
      if(!deletes.has(deletion))deletes.set(deletion,[]);
      deletes.get(deletion).push(variant);
    }
  }
  const result={exact,variants,deletes};
  cache.set(question,result);
  return result;
}
function closeCandidates(index,query) {
  const found=new Map();
  const consider=entry=>{
    if(!oneEditApart(entry.key,query))return;
    const signature=entry.key+"\u0000"+entry.label;
    if(!found.has(signature))found.set(signature,{...entry,matchKind:"typo"});
  };
  // Missing character in the submitted guess.
  for(const entry of index.deletes.get(query)||[])consider(entry);
  // Extra character, or one substitution in the submitted guess.
  const checked=new Set();
  for(let i=0;i<query.length;i++){
    const deletion=query.slice(0,i)+query.slice(i+1);
    if(checked.has(deletion))continue;
    checked.add(deletion);
    for(const entry of index.exact.get(deletion)||[])consider(entry);
    for(const entry of index.deletes.get(deletion)||[])consider(entry);
  }
  return [...found.values()];
}
// Deterministic spelling alternates of an existing, submitted approved name.
// Transformations NEVER add facts. We accept only if one canonical record in
// the current question already has an exact approved key for an alternate.
export function approvedNameSpellings(raw) {
  const name=String(raw??"").trim().replace(/\s+/g," ");
  if(name.length<3||name.length>100)return [];
  const options=new Set([name]);
  const transform=value=>{
    const variants=[];
    if(/^the\s+/i.test(value))variants.push(value.replace(/^the\s+/i,""));
    else variants.push("The "+value);
    const prefix=value.match(/^(the\s+)?(st|saint|mt|mount|ft|fort)\.?\s+(.+)$/i);
    if(prefix){
      const dictionary={st:"saint",saint:"st",mt:"mount",mount:"mt",ft:"fort",fort:"ft"};
      variants.push((prefix[1]||"")+dictionary[prefix[2].toLowerCase()]+" "+prefix[3]);
    }
    const suffix=value.match(/^(.+)\s+(jr|junior|sr|senior)\.?$/i);
    if(suffix){
      const swap={jr:"junior",junior:"jr",sr:"senior",senior:"sr"};
      variants.push(suffix[1]+" "+swap[suffix[2].toLowerCase()]);
    }
    const lastFirst=value.match(/^([^,]{2,60}),\s+([^,]{2,60})$/);
    if(lastFirst)variants.push(lastFirst[2]+" "+lastFirst[1]);
    return variants;
  };
  // Two passes let "The St. Louis" equal "Saint Louis" without creating
  // arbitrary meaning-changing synonyms or a costly fuzzy search.
  for(let pass=0;pass<2;pass++){
    const current=[...options];
    for(const item of current)for(const value of transform(item)){
      if(options.size<24)options.add(value);
    }
  }
  const base=normalizeAnswer(name);
  return [...new Set([...options].map(normalizeAnswer).filter(key=>key&&key!==base))].slice(0,23);
}
export function inspectRareGuess(question,raw) {
  const query=normalizeAnswer(raw);
  if(!query)return {status:"empty",match:null};
  if(query.length>100)return {status:"too_long",match:null};
  const index=indexQuestion(question),names=index.exact.get(query);
  if(names?.length===1)return {status:"accepted",match:names[0]};
  if(names?.length>1)return {status:"ambiguous",match:null};
  const spellings=approvedNameSpellings(raw);
  const equivalent=spellings.flatMap(key=>index.exact.get(key)||[]);
  const owners=new Set(equivalent.map(entry=>entry.label));
  if(owners.size>1)return {status:"ambiguous",match:null};
  if(equivalent.length)return {status:"accepted",match:{...equivalent[0],matchKind:"equivalent"}};
  if(query.length<5)return {status:"unrecognized",match:null};
  const close=closeCandidates(index,query);
  const owners=new Set(close.map(x=>x.label));
  if(owners.size>1)return {status:"ambiguous",match:null};
  return close.length
    ? {status:"accepted",match:close[0]}
    : {status:"unrecognized",match:null};
}
// Suggestions are non-authoritative: never assign points to an unrecognized
// answer. Only fully approved library entries can appear here.
export function suggestedApprovedAnswers(question,raw,max=3) {
  const query=normalizeAnswer(raw);
  if(query.length<5||query.length>100)return [];
  const indexed=indexQuestion(question);
  const direct=indexed.exact.get(query);
  if(direct?.length===1)return [];
  const seen=new Set();
  return closeCandidates(indexed,query)
    .filter(entry=>{if(seen.has(entry.label))return false;seen.add(entry.label);return true;})
    .slice(0,Math.max(0,Math.min(3,Number(max)||0)))
    .map(entry=>({label:entry.label,points:entry.points}));
}
export function rarityTier(points) {
  const p=Math.max(0,Math.min(1000,Number(points)||0));
  if(p>=850)return {id:"deep-cut",label:"DEEP CUT",message:"An especially obscure choice in our curated scoring tiers."};
  if(p>=600)return {id:"uncommon",label:"UNCOMMON",message:"A less obvious choice in our curated scoring tiers."};
  if(p>=350)return {id:"clever",label:"CLEVER PICK",message:"A solid answer beyond the most familiar options."};
  return {id:"familiar",label:"FAMILIAR",message:"A recognizable answer that still earns points."};
}
export function auditQuestionAliases(question) {
  const {exact}=indexQuestion(question);
  const collisions=[...exact.entries()].filter(([,rows])=>rows.length>1)
    .map(([key,rows])=>({key,names:rows.map(x=>x.label)}));
  const invalidPoints=(question.answers||[]).filter(([,points])=>
    !Number.isInteger(points)||points<1||points>1000);
  return {collisions,invalidPoints:invalidPoints.map(([name])=>name),
    answerCount:(question.answers||[]).length,
    variantCount:exact.size};
}
