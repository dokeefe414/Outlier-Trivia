// OUTLIER v1.3 — discovery and weekly editorial events.
// All local summaries are derived from actual accepted game results;
// no invented player percentiles or real-world popularity statistics.
import {buildArcadeRound,practiceCategoryOptions,randomFromSeed,seedFromString,weekStart} from "./game.js";
import {rareQuestions} from "./data.js";

const clampPoints = value => Number.isFinite(Number(value)) ? Math.max(0,Math.min(1000,Number(value))) : 0;
const safeAnswer = row => String(row?.accepted || "").slice(0,100);

export function dailyDebrief(questions,answers) {
  const completed=Array.isArray(answers)?answers:[];
  const prompts=Array.isArray(questions)?questions:[];
  const rows=completed.map((a,index)=>({
    type:a?.type==="fit"?"fit":"rare",points:clampPoints(a?.points),
    accepted:safeAnswer(a),valid:!!a?.valid,
    category:String(a?.category||prompts[index]?.category||"General").slice(0,70),
    questionId:String(a?.questionId||prompts[index]?.id||"").slice(0,110),
    prompt:String(prompts[index]?.prompt||"").slice(0,220)
  }));
  const rare=rows.filter(r=>r.type==="rare");
  const fit=rows.filter(r=>r.type==="fit");
  const bestRare=[...rare].filter(r=>r.valid).sort((a,b)=>b.points-a.points||a.accepted.localeCompare(b.accepted))[0]??null;
  const bestFit=[...fit].filter(r=>r.valid).sort((a,b)=>b.points-a.points)[0]??null;
  const missed=rows.filter(r=>!r.valid);
  const total=rows.reduce((sum,r)=>sum+r.points,0);
  const rareTotal=rare.reduce((sum,r)=>sum+r.points,0);
  const fitTotal=fit.reduce((sum,r)=>sum+r.points,0);
  const breakdown=new Map();
  for(const row of rows){
    const existing=breakdown.get(row.category)||{name:row.category,points:0,rounds:0};
    existing.points+=row.points;existing.rounds++;breakdown.set(row.category,existing);
  }
  const categories=[...breakdown.values()].sort((a,b)=>b.points/b.rounds-a.points/a.rounds||a.name.localeCompare(b.name));
  return {total,rounds:rows.length,accepted:rows.length-missed.length,rareTotal,fitTotal,bestRare,bestFit,
    missed,rows,categories,weakest:categories.at(-1)||null,strongest:categories[0]||null};
}

export function weeklySpotlight(day) {
  const week=weekStart(day);
  const eligible=practiceCategoryOptions
    .filter(option=>option.value!=="surprise")
    .map(option=>({...option,count:rareQuestions.filter(q=>q.bigPool && q.poolGroup===option.value).length}))
    .filter(option=>option.count>=2);
  if(!eligible.length)throw new Error("No eligible weekly spotlight categories");
  const index=Math.floor(randomFromSeed(seedFromString("outlier-weekly-v13:"+week))()*eligible.length);
  const chosen=eligible[index];
  return {id:week+":"+chosen.value,week,category:chosen.value,title:chosen.label,
    icon:chosen.icon,description:chosen.detail,
    rules:"Ten Stand Out rounds, 30 seconds each. Same weekly question slate for every player. Unranked."};
}

export function weeklySpotlightRound(day) {
  const event=weeklySpotlight(day);
  const random=randomFromSeed(seedFromString("outlier-weekly-v13-questions:"+event.id));
  return buildArcadeRound(day,event.category,"rare-rush",random);
}

// Server-verified league scores are only used for display. This function
// never awards ranks, points, entitlements or client-supplied official wins.
export function weeklyCup(players,period="week") {
  const entries=Array.isArray(players)?players:[];
  const sorted=entries.filter(p=>p && typeof p.userId==="string")
    .map(p=>({userId:p.userId,name:String(p.name||"Player"),score:Math.max(0,Number(p.score)||0),
      days:Math.max(0,Number(p.days)||0)}))
    .sort((a,b)=>a.userId.localeCompare(b.userId));
  const matchups=[];
  for(let i=0;i+1<sorted.length;i+=2){
    const a=sorted[i],b=sorted[i+1];
    // Do not declare a winner on zero played days.
    const winner=!(a.days||b.days)?null:
      a.score!==b.score?(a.score>b.score?a:b):
      a.days!==b.days?(a.days>b.days?a:b):null;
    matchups.push({a,b,winner,draw:!!(a.days||b.days)&&!winner});
  }
  return {period,matchups,bye:sorted.length%2?sorted.at(-1):null,
    participants:sorted.length,final:period==="last-week",
    note:"Pairings are alphabetical by account ID and can change as members join. Scores are server-verified official weekly totals; these are exhibition head-to-head comparisons, not an elimination bracket."};
}

export function duelSummary(one,two) {
  const a=Array.isArray(one)?one:[];
  const b=Array.isArray(two)?two:[];
  const total=rows=>rows.reduce((points,answer)=>points+clampPoints(answer?.points),0);
  const oneScore=total(a),twoScore=total(b);
  const roundCount=Math.max(a.length,b.length);
  return {oneScore,twoScore,roundCount,
    outcome:oneScore===twoScore?"tie":oneScore>twoScore?"one":"two",
    oneAccepted:a.filter(x=>x?.valid).length,
    twoAccepted:b.filter(x=>x?.valid).length
  };
}
