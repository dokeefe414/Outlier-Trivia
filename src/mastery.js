// OUTLIER v1.7 Knowledge Mastery. Cosmetics and personal records only.
// Each score is derived from completed, 7-answer official daily games;
// no local practice, party results or online exhibition can inflate them.
import {scoreOf} from "./game.js";

const complete=run=>run?.complete===true&&Array.isArray(run.answers)&&run.answers.length===7;
const levels=[
  {name:"ROOKIE",minimum:0,icon:"◌"},
  {name:"CURIOUS",minimum:180,icon:"✦"},
  {name:"SPECIALIST",minimum:540,icon:"◇"},
  {name:"EXPERT",minimum:1200,icon:"◆"},
  {name:"SAGE",minimum:2600,icon:"✹"}
];
export const MASTERY_LEVELS=Object.freeze(levels);
const thresholds=Object.freeze([
  {id:"first-rare",title:"FIRST FIND",icon:"✦",description:"Find your first accepted Stand Out answer.",goal:1},
  {id:"deep-cut-5",title:"THE DEEP FILE",icon:"💎",description:"Find five Stand Out answers worth at least 850 points.",goal:5},
  {id:"deep-cut-25",title:"ARCHIVE LEGEND",icon:"✹",description:"Collect 25 deep-cut answers.",goal:25},
  {id:"subject-hopper",title:"POLYMATH",icon:"◎",description:"Get correct answers in ten different categories.",goal:10},
  {id:"perfect-rare",title:"FOUR FOR FOUR",icon:"✧",description:"Accept all four Stand Out picks in one daily game.",goal:1},
  {id:"high-score",title:"THE 5K CLUB",icon:"♛",description:"Score 5,000 or more in one official daily.",goal:1}
]);
export const MASTERY_TROPHIES=thresholds;

const safePoints=answer=>Math.max(0,Math.min(1000,Number(answer?.points)||0));
export function personalMastery(days={}) {
  const completed=Object.entries(days??{}).filter(([,run])=>complete(run))
    .sort(([a],[b])=>a.localeCompare(b));
  const topics=new Map(),rareNames=new Set(),distinct=new Set();
  let deepCuts=0,rareAccepted=0,flawlessRare=0,best=0,highestDay=null,highScore=0;
  for(const [day,run] of completed){
    const total=scoreOf(run.answers);
    if(total>best){best=total;highestDay=day;}
    if(total>=5000)highScore++;
    const rare=run.answers.filter(a=>a.type==="rare");
    if(rare.length===4&&rare.every(a=>a.valid))flawlessRare++;
    for(const answer of run.answers){
      const points=safePoints(answer);
      const accepted=answer?.valid===true;
      const topic=String(answer?.category||"GENERAL").slice(0,36).toUpperCase();
      if(!topics.has(topic))topics.set(topic,{name:topic,xp:0,played:0,accepted:0,points:0});
      const record=topics.get(topic);
      record.played++;record.points+=points;
      if(accepted){
        record.accepted++;
        distinct.add(topic);
        record.xp+=answer.type==="rare"?80+Math.round(points/15):50+Math.round(points/20);
      }else record.xp+=10;
      if(answer.type==="rare"&&accepted){
        rareAccepted++;
        rareNames.add(String(answer.accepted||"").trim().toLocaleLowerCase("en-US"));
        if(points>=850)deepCuts++;
      }
    }
  }
  const categories=[...topics.values()].map(x=>{
    const level=[...levels].reverse().find(l=>x.xp>=l.minimum)||levels[0];
    const next=levels.find(l=>l.minimum>x.xp)||null;
    const earned=level.minimum,remaining=next?next.minimum-x.xp:0;
    return {...x,level:level.name,icon:level.icon,remaining,
      progress:next?Math.round((x.xp-earned)/(next.minimum-earned)*100):100};
  }).sort((a,b)=>b.xp-a.xp||a.name.localeCompare(b.name));
  const metrics={"first-rare":rareAccepted,"deep-cut-5":deepCuts,"deep-cut-25":deepCuts,
    "subject-hopper":distinct.size,"perfect-rare":flawlessRare,"high-score":highScore};
  const trophies=thresholds.map(t=>({...t,value:metrics[t.id]||0,
    unlocked:(metrics[t.id]||0)>=t.goal,
    progress:Math.min(100,Math.round((metrics[t.id]||0)/t.goal*100))}));
  return {days:completed.length,personalBest:best,personalBestDay:highestDay,
    distinctRare:rareNames.size,deepCuts,trophies,
    categories,trophyCount:trophies.filter(t=>t.unlocked).length};
}
