// OUTLIER v1.1 — locally-earned player identity and Knowledge Atlas.
// All progression is cosmetic, derived from completed official daily results.
// No practice, checkout, local title, or friend challenge can change scores.
import {scoreOf} from "./game.js";
import {categoryInsights} from "./social.js";
import {currentStreak,longestStreak} from "./progression.js";

const official = run => Boolean(run?.complete && Array.isArray(run.answers) && run.answers.length===7);
const clamp = (num,max=1000) => Math.max(0,Math.min(max,Number(num)||0));
const utc = day => /^\d{4}-\d{2}-\d{2}$/.test(day);
const rows = days => Object.entries(days??{}).filter(([day,run])=>utc(day)&&official(run))
  .sort(([dayA],[dayB])=>dayA.localeCompare(dayB));

export const PLAYER_TITLES=Object.freeze([
  {id:"curious",name:"Curious Mind",icon:"✦",days:0,description:"Every outlier starts somewhere."},
  {id:"seeker",name:"Knowledge Seeker",icon:"✧",days:3,description:"Three completed official daily games."},
  {id:"archivist",name:"Archive Diver",icon:"◇",days:7,description:"Seven completed official daily games."},
  {id:"rare-mind",name:"Rare Mind",icon:"💎",days:15,description:"Fifteen completed official daily games."},
  {id:"legend",name:"OUTLIER Legend",icon:"♛",days:30,description:"Thirty completed official daily games."}
]);
export const PLAYER_FRAMES=Object.freeze([
  {id:"classic",name:"Classic",icon:"◇",description:"The original OUTLIER card.",condition:"starter"},
  {id:"stargazer",name:"Stargazer",icon:"✶",description:"Complete 3 official daily games.",condition:"three"},
  {id:"diamond",name:"Diamond",icon:"💎",description:"Find a 950+ Stand Out answer.",condition:"rare"},
  {id:"perfect",name:"Perfect Seven",icon:"✸",description:"Finish one daily with seven accepted answers.",condition:"perfect"},
  {id:"marathon",name:"Marathon",icon:"⚡",description:"Play seven days in a row.",condition:"streak"}
]);

export function identityProgress(days,selected={}) {
  const completed=rows(days);
  const daysPlayed=completed.length;
  const totals=completed.map(([,run])=>scoreOf(run.answers));
  const answers=completed.flatMap(([,run])=>run.answers);
  const bestRare=answers.filter(a=>a.type==="rare"&&a.valid)
    .reduce((best,a)=>Math.max(best,clamp(a.points)),0);
  const perfect=completed.some(([,run])=>run.answers.every(a=>a.valid));
  const streak=longestStreak(days);
  const xp=totals.reduce((value,score)=>value+50+Math.floor(score/100),0);
  const unlockedTitles=PLAYER_TITLES.map(t=>({...t,unlocked:daysPlayed>=t.days,
    remaining:Math.max(0,t.days-daysPlayed)}));
  const unlockedFrames=PLAYER_FRAMES.map(frame=>({...frame,
    unlocked:frame.condition==="starter"||
      (frame.condition==="three"&&daysPlayed>=3)||
      (frame.condition==="rare"&&bestRare>=950)||
      (frame.condition==="perfect"&&perfect)||
      (frame.condition==="streak"&&streak>=7)
  }));
  const title=unlockedTitles.find(t=>t.id===selected.title&&t.unlocked)
    ?? [...unlockedTitles].reverse().find(t=>t.unlocked) ?? unlockedTitles[0];
  const frame=unlockedFrames.find(f=>f.id===selected.frame&&f.unlocked) ?? unlockedFrames[0];
  return {daysPlayed,completed,answers,bestRare,streak,perfect,xp,title,frame,
    titles:unlockedTitles,frames:unlockedFrames};
}

export function atlasProfile(days,today) {
  const identity=identityProgress(days);
  const categories=categoryInsights(days).sort((a,b)=>
    b.average-a.average || b.attempts-a.attempts || a.name.localeCompare(b.name));
  const rare=identity.completed.flatMap(([day,run])=>
    run.answers.filter(a=>a.type==="rare"&&a.valid&&a.accepted&&a.points>0)
      .map(a=>({day,answer:String(a.accepted).slice(0,100),
        points:clamp(a.points),category:String(a.category||"OTHER").slice(0,60)})));
  const unique=new Map();
  for(const a of rare) {
    const key=a.category+"|"+a.answer.toLocaleLowerCase("en-US");
    if(!unique.has(key) || unique.get(key).points<a.points)unique.set(key,a);
  }
  const highest=[...unique.values()].sort((a,b)=>b.points-a.points||
    a.answer.localeCompare(b.answer)).slice(0,5);
  const fitCorrect=identity.answers.filter(a=>a.type==="fit"&&a.valid).length;
  const fitRounds=identity.answers.filter(a=>a.type==="fit").length;
  const rareCorrect=identity.answers.filter(a=>a.type==="rare"&&a.valid).length;
  const rareRounds=identity.answers.filter(a=>a.type==="rare").length;
  const recent=identity.completed.slice(-7);
  const recentAvg=recent.length?Math.round(recent.reduce((total,[,run])=>
    total+scoreOf(run.answers),0)/recent.length):0;
  return {
    ...identity,
    categories,
    highest,
    uniqueRareAnswers:unique.size,
    rareAccuracy:rareRounds?Math.round(100*rareCorrect/rareRounds):0,
    crowdAccuracy:fitRounds?Math.round(100*fitCorrect/fitRounds):0,
    recentAverage:recentAvg,
    currentStreak:today?currentStreak(days,today):0,
    strongest:categories[0]??null,
    weakest:categories.filter(x=>x.attempts>=3).at(-1)??null
  };
}
function monday(day) {
  const d=new Date(day+"T12:00:00Z");
  d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
  return d.toISOString().slice(0,10);
}
export function weeklyMissions(days,today) {
  if(!utc(today))throw new Error("Invalid UTC date");
  const start=monday(today);
  const completed=rows(days).filter(([day])=>day>=start && day<=today);
  const answers=completed.flatMap(([,run])=>run.answers);
  const total=completed.reduce((v,[,run])=>v+scoreOf(run.answers),0);
  const goodRare=answers.filter(a=>a.type==="rare"&&a.valid).length;
  const topFit=answers.filter(a=>a.type==="fit"&&a.valid&&a.points===1000).length;
  return [
    {id:"habit",icon:"📅",label:"Three-day explorer",goal:3,value:completed.length,
      reward:"WEEKLY EXPLORER",description:"Complete three official games this week."},
    {id:"rare",icon:"💎",label:"Rare-answer hunter",goal:8,value:goodRare,
      reward:"WEEKLY TREASURE HUNTER",description:"Lock in eight accepted Stand Out answers."},
    {id:"crowd",icon:"◎",label:"Read the room",goal:4,value:topFit,
      reward:"WEEKLY MIND READER",description:"Pick four top Fit In answers across the week."},
    {id:"points",icon:"✦",label:"Point collector",goal:10000,value:total,
      reward:"WEEKLY SCORE STAR",description:"Earn 10,000 cumulative official daily points."}
  ].map(m=>({...m,value:Math.min(m.goal,m.value),complete:m.value>=m.goal,
    progress:Math.min(100,Math.round(100*m.value/m.goal))}));
}
export function completedMissionCount(days,today) {
  return weeklyMissions(days,today).filter(m=>m.complete).length;
}
