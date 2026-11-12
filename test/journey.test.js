import test from "node:test";
import assert from "node:assert/strict";
import {scoreHistory,weekSummary,nextGoal,versusHistory,utcResetRemaining} from "../src/journey.js";
const answers=points=>Array.from({length:7},(_,i)=>({
  points:i%2===0?points:Math.min(1000,points+20),type:i%2===0?"rare":"fit",valid:true
}));
const complete=points=>({answers:answers(points),complete:true});
test("weekly summary includes only completed official days and finds current streak",()=>{
  const days={
    "2026-11-09":complete(400),
    "2026-11-10":complete(600),
    "2026-11-11":complete(500),
    "2026-11-12":{complete:false,answers:answers(1000)},
    "2026-11-07":complete(800)
  };
  const week=weekSummary(days,"2026-11-12");
  assert.equal(week.start,"2026-11-09");
  assert.equal(week.days.length,7);
  assert.equal(week.played,3);
  assert.equal(week.streak,3);
  assert.equal(week.days.filter(x=>x.played).length,3);
  assert.ok(week.total>10000);
  assert.equal(scoreHistory(days,28,"2026-11-12").length,28);
  assert.equal(scoreHistory(days,4,"2026-11-12").filter(x=>x.played).length,3);
  assert.equal(scoreHistory(days,4,"2026-11-12").at(-1).score,null);
});
test("milestones and comparison distinguish actual daily performance",()=>{
  const days={"2026-11-10":complete(400),"2026-11-11":complete(600)};
  const goal=nextGoal(days,"2026-11-12");
  assert.equal(goal.daysPlayed,2);
  assert.equal(goal.nextDayMilestone,3);
  assert.equal(goal.daysRemaining,1);
  const compare=versusHistory(days,"2026-11-12",6000);
  assert.ok(compare.personalBest);
  assert.ok(compare.change>0);
  assert.equal(versusHistory(days,"2026-11-10",2000),null);
  assert.equal(weekSummary({},"2026-11-12").played,0);
});
test("daily reset countdown is UTC-based rather than local timezone",()=>{
  assert.deepEqual(utcResetRemaining(new Date("2026-11-12T23:59:50Z")),{hours:0,minutes:0,seconds:10});
  assert.deepEqual(utcResetRemaining(new Date("2026-11-12T00:00:00Z")),{hours:24,minutes:0,seconds:0});
  assert.throws(()=>scoreHistory({},500),/Invalid history window/);
});
