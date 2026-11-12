import test from "node:test";
import assert from "node:assert/strict";
import {THEMES,TOUR_STEPS,completedDailyCount,unlockableThemes,weeklySeason,
 seasonArchive,betaChecklistState,safeFeedbackUrl} from "../src/beta.js";
const makeRun=score=>({complete:true,answers:Array.from({length:7},()=>({points:score,type:"rare",valid:true}))});
test("tour includes scoring transparency and makes no unsupported popularity claims",()=>{
 assert.equal(TOUR_STEPS.length,4);
 assert.ok(TOUR_STEPS.some(s=>(s.description+" "+s.hint).includes("estimated tiers")));
 assert.ok(TOUR_STEPS.some(s=>(s.description+" "+s.hint).includes("sample distributions")));
 assert.equal(new Set(TOUR_STEPS.map(s=>s.title)).size,4);
});
test("cosmetic themes unlock ONLY on completed official daily games",()=>{
 const days={"2026-11-09":makeRun(600),"2026-11-10":makeRun(500),
  "2026-11-11":{complete:false,answers:makeRun(1000).answers}};
 assert.equal(completedDailyCount(days),2);
 assert.deepEqual(THEMES.map(x=>x.requirement),[0,3,7,14]);
 const one=unlockableThemes(days,"champion");
 assert.equal(one.active,"nebula");
 assert.equal(one.themes.find(t=>t.id==="aurora").remaining,1);
 days["2026-11-12"]=makeRun(200);
 assert.equal(unlockableThemes(days,"aurora").active,"aurora");
 for(let i=13;i<=23;i++)days["2026-11-"+i]=makeRun(1000);
 assert.equal(unlockableThemes(days,"champion").active,"champion");
});
test("weekly season rewards depend on days, never points or premium spending",()=>{
 const days=Object.fromEntries([9,10,11,12,13].map(x=>["2026-11-"+String(x).padStart(2,"0"),makeRun(0)]));
 const season=weeklySeason(days,"2026-11-12");
 assert.equal(season.monday,"2026-11-09");
 assert.equal(season.completed,5);
 assert.equal(season.achieved.id,"ace");
 assert.equal(season.next.id,"legend");
 assert.equal(season.needed,2);
 assert.equal(season.total,0);
 const last=seasonArchive(days,"2026-11-19");
 assert.equal(last.length,1);
 assert.equal(last[0].badge,"Ace");
 const empty=weeklySeason({},"2026-11-19");
 assert.equal(empty.achieved,null);
});
test("beta checklist is explicitly opt-in; feedback links contain no personal data",()=>{
 const days={"2026-11-09":makeRun(100)};
 const progress=betaChecklistState(days,{tutorial:true,shared:false,practice:true});
 assert.equal(progress.filter(x=>x.done).length,3);
 const link=safeFeedbackUrl("https://github.com/dokeefe414/Outlier-Trivia/issues/new","Gameplay bug","PRIVATE_INFO");
 assert.ok(link.includes("template=beta-feedback.yml"));
 assert.ok(!link.includes("PRIVATE_INFO"));
 assert.ok(link.includes("%5BBeta%5D"));
 assert.equal(seasonArchive({},"2026-11-19").length,0);
});
