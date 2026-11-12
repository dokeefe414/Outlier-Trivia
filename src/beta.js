// OUTLIER v0.7: local cosmetics, weekly season rewards and privacy-first beta.
// Only completed OFFICIAL daily games contribute. No spending, account or
// practice score can accelerate these cosmetic unlocks.
import { scoreOf, weekStart, utcDay } from "./game.js";

export const THEMES = Object.freeze([
  { id:"nebula", name:"Nebula", symbol:"✦", requirement:0, description:"The classic violet OUTLIER look" },
  { id:"aurora", name:"Aurora", symbol:"❋", requirement:3, description:"A vivid ocean-green glow" },
  { id:"sunset", name:"Sunset", symbol:"☀", requirement:7, description:"A lively sunset-inspired accent" },
  { id:"champion", name:"Champion", symbol:"♛", requirement:14, description:"Gold details for daily regulars" }
]);
export const TOUR_STEPS = Object.freeze([
  {
    title:"WELCOME TO OUTLIER", symbol:"✦", eyebrow:"01 / 04",
    description:"Seven shared questions every day. Four times you'll try to stand out, and three times you'll fit in. Everyone gets the same daily challenge.",
    hint:"Your free daily round is always the main event."
  },
  {
    title:"STAND OUT", symbol:"💎", eyebrow:"02 / 04",
    description:"Type a valid answer from a large approved pool. Familiar answers earn some points; clever, less-obvious choices score more.",
    hint:"For now, rarity scores use estimated tiers—not live player statistics."
  },
  {
    title:"FIT IN", symbol:"◎", eyebrow:"03 / 04",
    description:"Here you want to think like everyone else. Pick the answer you expect to be the crowd favorite. The top example choice gets 1,000 points.",
    hint:"Fit In crowd shares are sample distributions during the beta."
  },
  {
    title:"PLAY YOUR WAY", symbol:"🏆", eyebrow:"04 / 04",
    description:"Finish your seven-question daily, share a spoiler-free challenge, build streaks, or practice in Quick Hit, Classic, and Rare Rush.",
    hint:"Practice never counts toward official scores. Daily game resets at 00:00 UTC."
  }
]);
const official = run => Boolean(run?.complete && Array.isArray(run.answers) && run.answers.length===7);
function dayOffset(day,offset){
  const date=new Date(day+"T12:00:00.000Z");
  date.setUTCDate(date.getUTCDate()+offset);
  return date.toISOString().slice(0,10);
}
export function completedDailyCount(days){
  return Object.values(days || {}).filter(official).length;
}
export function unlockableThemes(days,selected="nebula"){
  const count=completedDailyCount(days);
  const eligible=THEMES.map(t=>({...t,unlocked:count>=t.requirement,
    remaining:Math.max(0,t.requirement-count)}));
  const active=eligible.find(t=>t.id===selected && t.unlocked)?.id || "nebula";
  return {active,played:count,themes:eligible};
}
export function weeklySeason(days,day=utcDay()){
  const monday=weekStart(day);
  const week=Array.from({length:7},(_,i)=>{
    const date=dayOffset(monday,i),run=days?.[date];
    return {date,complete:official(run),points:official(run)?scoreOf(run.answers):0};
  });
  const played=week.filter(x=>x.complete);
  const points=played.reduce((sum,x)=>sum+x.points,0);
  const count=played.length;
  const tiers=[
    {id:"rookie",name:"Rookie",threshold:1,symbol:"✦"},
    {id:"contender",name:"Contender",threshold:3,symbol:"⚡"},
    {id:"ace",name:"Ace",threshold:5,symbol:"💎"},
    {id:"legend",name:"Legend",threshold:7,symbol:"♛"}
  ];
  const achieved=tiers.filter(t=>count>=t.threshold).at(-1)||null;
  const next=tiers.find(t=>count<t.threshold)||null;
  return {monday,week,completed:count,total:points,average:count?Math.round(points/count):0,
    achieved,next,needed:next?next.threshold-count:0,tiers,
    ended:dayOffset(monday,7) <= day};
}
export function seasonArchive(days,day=utcDay(),count=8){
  if(!Number.isInteger(count)||count<1||count>52)throw new Error("Invalid season count");
  const monday=weekStart(day);
  return Array.from({length:count},(_,i)=>{
    const weekDay=dayOffset(monday,-7*(i+1));
    const summary=weeklySeason(days,weekDay);
    return {start:summary.monday,completed:summary.completed,total:summary.total,
      badge:summary.achieved?.name||"Unranked"};
  }).filter(x=>x.completed>0);
}
export function betaChecklistState(days,options={}){
  const played=completedDailyCount(days);
  return [
    {id:"tutorial",label:"Learn the two scoring styles",done:Boolean(options.tutorial)},
    {id:"daily",label:"Finish your first daily game",done:played>0},
    {id:"practice",label:"Try a practice format",done:Boolean(options.practice)},
    {id:"share",label:"Send a challenge to a friend",done:Boolean(options.shared)}
  ];
}
export function safeFeedbackUrl(base,kind,detail=""){
  const types=new Set(["Wrong answer","Gameplay bug","Design feedback","New question idea","Other"]);
  const selected=types.has(kind)?kind:"Other";
  const issue=new URL(base);
  issue.searchParams.set("template","beta-feedback.yml");
  issue.searchParams.set("title","[Beta] "+selected);
  // Never append emails, username, scores, response histories or localStorage.
  // The user types detail voluntarily in GitHub, not through a URL.
  return issue.toString();
}
