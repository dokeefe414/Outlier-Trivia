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
export function indexQuestion(question) {
  if(cache.has(question)) return cache.get(question);
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
  const result={exact,variants};
  cache.set(question,result);
  return result;
}
export function inspectRareGuess(question,raw) {
  const query=normalizeAnswer(raw);
  if(!query) return {status:"empty",match:null};
  if(query.length>100) return {status:"too_long",match:null};
  const {exact,variants}=indexQuestion(question);
  const names=exact.get(query);
  if(names?.length===1)return {status:"accepted",match:names[0]};
  if(names?.length>1)return {status:"ambiguous",match:null};
  if(query.length<5)return {status:"unrecognized",match:null};
  let candidate=null;
  for(const item of variants) {
    if(Math.abs(item.key.length-query.length)>1)continue;
    if(!oneEditApart(item.key,query))continue;
    if(candidate && candidate.label!==item.label) {
      return {status:"ambiguous",match:null};
    }
    candidate={...item,matchKind:"typo"};
  }
  return candidate
    ? {status:"accepted",match:candidate}
    : {status:"unrecognized",match:null};
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
