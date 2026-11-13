import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAYER_TITLES,PLAYER_FRAMES,identityProgress,
  atlasProfile,weeklyMissions,completedMissionCount
} from "../src/player-atlas.js";
const makeRun=(scores=[200,400,300,400,500,700,250])=>({
  complete:true,answers:scores.map((points,i)=>({
    type:i%2===0?"rare":"fit",
    points,valid:points>0,
    category:i%2===0?"MOVIES":"SCIENCE",
    accepted:points>0?"Answer "+i:undefined
  }))
});
test("player titles and frames are earned only by completed official dailies",()=>{
  const days={
    "2026-11-09":makeRun(),
    "2026-11-10":{complete:false,answers:makeRun([1000,1000,1000,1000,1000,1000,1000]).answers},
    "2026-11-11":makeRun([960,500,150,500,300,1000,110]),
    "practice":makeRun([1000,1000,1000,1000,1000,1000,1000])
  };
  const before=identityProgress(days,{title:"rare-mind",frame:"diamond"});
  assert.equal(before.daysPlayed,2);
  assert.equal(before.title.id,"curious");
  assert.equal(before.frame.id,"diamond");
  assert.equal(before.bestRare,960);
  assert.equal(before.titles.filter(t=>t.unlocked).length,1);
  assert.equal(before.frames.some(f=>f.id==="marathon"&&f.unlocked),false);
  assert.ok(before.xp>100);
  days["2026-11-12"]=makeRun();
  const after=identityProgress(days,{title:"seeker",frame:"stargazer"});
  assert.equal(after.daysPlayed,3);
  assert.equal(after.title.id,"seeker");
  assert.equal(after.frame.id,"stargazer");
  assert.equal(PLAYER_TITLES.length,5);
  assert.equal(PLAYER_FRAMES.length,5);
});
test("Knowledge Atlas uses completed official days, dedupes accepted rare names",()=>{
 const days={"2026-11-09":makeRun(),"2026-11-10":makeRun()};
 const profile=atlasProfile(days,"2026-11-12");
 assert.equal(profile.daysPlayed,2);
 assert.equal(profile.rareAccuracy,100);
 assert.equal(profile.crowdAccuracy,100);
 assert.equal(profile.uniqueRareAnswers,4);
 assert.equal(profile.highest.length,4);
 assert.equal(profile.highest[0].points,500);
 assert.equal(profile.categories.length,2);
 assert.ok(profile.strongest);
 assert.ok(profile.recentAverage>0);
 assert.deepEqual(atlasProfile({},"2026-11-12").highest,[]);
});
test("weekly knowledge quests reset on UTC Mondays and ignore incomplete games",()=>{
 const days={
   "2026-11-08":makeRun([1000,1000,1000,1000,1000,1000,1000]),
   "2026-11-09":makeRun([700,1000,600,1000,750,1000,800]),
   "2026-11-10":makeRun([700,1000,600,1000,750,1000,800]),
   "2026-11-11":{complete:false,answers:makeRun().answers},
   "2026-11-12":makeRun([800,1000,700,900,750,1000,600])
 };
 const missions=weeklyMissions(days,"2026-11-12");
 assert.equal(missions.length,4);
 assert.equal(missions.find(m=>m.id==="habit").value,3);
 assert.equal(missions.find(m=>m.id==="rare").value,8);
 assert.ok(missions.find(m=>m.id==="points").complete);
 assert.equal(completedMissionCount(days,"2026-11-12"),4);
 const next=weeklyMissions(days,"2026-11-16");
 assert.equal(next.filter(m=>m.complete).length,0);
 assert.throws(()=>weeklyMissions(days,"not-a-day"),/Invalid UTC date/);
});
