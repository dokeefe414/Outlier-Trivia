// Long-term personal progression from completed official days only.
// Nothing here is a verified public leaderboard, ranking or crowd statistic.
import {scoreOf,weekStart,utcDay} from "./game.js";
import {currentStreak,longestStreak} from "./progression.js";

function completed(run){
  return Boolean(run?.complete && Array.isArray(run.answers) && run.answers.length===7);
}
function shift(day,offset){
  const date=new Date(day+"T12:00:00Z");
  date.setUTCDate(date.getUTCDate()+offset);
  return date.toISOString().slice(0,10);
}
export function scoreHistory(days,count=30,today=utcDay()){
  if(!Number.isInteger(count)||count<1||count>365)throw new Error("Invalid history window");
  return Array.from({length:count},(_,index)=>{
    const day=shift(today,index-count+1);
    const run=days?.[day];
    return {day,played:completed(run),score:completed(run)?scoreOf(run.answers):null};
  });
}
export function weekSummary(days,today=utcDay()){
  const start=weekStart(today);
  const currentDays=Array.from({length:7},(_,index)=>{
    const day=shift(start,index);
    const run=days?.[day];
    return {day,played:completed(run),score:completed(run)?scoreOf(run.answers):null};
  });
  const lastStart=shift(start,-7);
  const previous=Array.from({length:7},(_,i)=>{
    const run=days?.[shift(lastStart,i)];
    return completed(run)?scoreOf(run.answers):null;
  }).filter(value=>value!==null);
  const played=currentDays.filter(d=>d.played);
  const average=played.length?Math.round(played.reduce((s,d)=>s+d.score,0)/played.length):0;
  const lastAvg=previous.length?Math.round(previous.reduce((a,b)=>a+b,0)/previous.length):null;
  return {
    start,days:currentDays,played:played.length,total:played.reduce((s,d)=>s+d.score,0),
    average,lastAverage:lastAvg,delta:lastAvg===null?null:average-lastAvg,
    streak:currentStreak(days,today),longest:longestStreak(days)
  };
}
export function nextGoal(days,today=utcDay()){
  const completedDays=Object.values(days??{}).filter(completed);
  const daysPlayed=completedDays.length;
  const milestones=[1,3,7,14,30,50,100,200,365,500,1000];
  const next=milestones.find(value=>value>daysPlayed) ?? daysPlayed+100;
  const streak=currentStreak(days,today);
  const nextStreak=[3,7,14,30,50,100,365].find(value=>value>streak)??streak+100;
  const scores=completedDays.map(r=>scoreOf(r.answers));
  const best=Math.max(0,...scores);
  return {
    daysPlayed,nextDayMilestone:next,daysRemaining:next-daysPlayed,
    dayProgress:Math.min(100,Math.round(daysPlayed/next*100)),
    streak,nextStreak,streakRemaining:nextStreak-streak,
    best,nextScoreGoal:Math.min(7000,Math.ceil((best+1)/500)*500)
  };
}
export function versusHistory(days,day,score){
  const completedDays=Object.entries(days??{})
    .filter(([d,r])=>d<day&&completed(r))
    .sort((a,b)=>a[0].localeCompare(b[0]));
  if(!completedDays.length)return null;
  const previous=scoreOf(completedDays[completedDays.length-1][1].answers);
  const avg=Math.round(completedDays.reduce((s,[,r])=>s+scoreOf(r.answers),0)/completedDays.length);
  return {
    previous,average:avg,change:score-previous,aboveAverage:score>=avg,
    bestBefore:Math.max(...completedDays.map(([,r])=>scoreOf(r.answers))),
    personalBest:score>Math.max(...completedDays.map(([,r])=>scoreOf(r.answers)))
  };
}
export function utcResetRemaining(now=new Date()){
  const next=new Date(now);
  next.setUTCHours(24,0,0,0);
  const seconds=Math.max(0,Math.ceil((next-now)/1000));
  return {hours:Math.floor(seconds/3600),minutes:Math.floor(seconds%3600/60),seconds:seconds%60};
}
