// OUTLIER public-content integrity only. Absolutely no private ranked keys,
// user guesses, admin tokens or source files containing personal information.
import {auditQuestionAliases,normalizeAnswer} from "./answer-intelligence.js";
const label=q=>q.poolGroup||q.category?.toLowerCase()||"misc";
export function contentQualitySnapshot(rare=[],fit=[]){
  const topics=new Map(),warnings=[],largest=[];
  let rareAnswers=0,aliases=0,invalidScores=0,collisions=0,sourceScoped=0;
  for(const q of rare){
    const name=label(q);
    const stat=topics.get(name)||{name,rare:0,fit:0,answers:0,aliases:0,scoped:0};
    stat.rare++;
    const rows=Array.isArray(q.answers)?q.answers:[];
    stat.answers+=rows.length;rareAnswers+=rows.length;
    const a=rows.reduce((n,row)=>n+(Array.isArray(row?.[2])?row[2].length:0),0);
    stat.aliases+=a;aliases+=a;
    if(q.bigPool){stat.scoped++;sourceScoped++;}
    const audit=auditQuestionAliases(q);
    collisions+=audit.collisions.length;invalidScores+=audit.invalidPoints.length;
    if(audit.collisions.length)warnings.push({id:q.id,kind:"alias collision",count:audit.collisions.length});
    if(audit.invalidPoints.length)warnings.push({id:q.id,kind:"invalid score",count:audit.invalidPoints.length});
    if(q.arcadeOnly&&!q.bigPool)warnings.push({id:q.id,kind:"unexpected exhibition scope",count:1});
    topics.set(name,stat);
    largest.push({id:q.id,category:name,answerSlots:rows.length,scope:q.arcadeOnly?"unranked":"daily-eligible"});
  }
  for(const q of fit){
    const name=label(q),stat=topics.get(name)||{name,rare:0,fit:0,answers:0,aliases:0,scoped:0};
    stat.fit++;
    const choices=Array.isArray(q.choices)?q.choices:[];
    if(choices.length!==6 || choices.some(x=>!Array.isArray(x)||!Number.isInteger(x?.[1]))||
      choices.reduce((n,row)=>n+Number(row?.[1]||0),0)!==100 ||
      new Set(choices.map(x=>normalizeAnswer(x?.[0]))).size!==6)
      warnings.push({id:q.id,kind:"invalid editorial Fit In weights",count:1});
    topics.set(name,stat);
  }
  return {
    rareQuestions:rare.length,fitQuestions:fit.length,answerSlots:rareAnswers,
    aliases,sourceScopedPrompts:sourceScoped,collisions,invalidScores,
    groupStats:[...topics.values()].sort((a,b)=>b.answers-a.answers||a.name.localeCompare(b.name)),
    largest:largest.sort((a,b)=>b.answerSlots-a.answerSlots).slice(0,16),
    warnings:warnings.slice(0,100),warningCount:warnings.length,
    editorialNotice:"Answer slots overlap across question lists. Editorial rarity tiers are not player probabilities. A source-listed entity may not be eligible for another prompt.",
    privacy:"This snapshot analyzes only the published prototype. No account or room data is accessed."
  };
}
