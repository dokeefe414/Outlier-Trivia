import test from "node:test";
import assert from "node:assert/strict";
import {dailyDebrief,weeklySpotlight,weeklySpotlightRound,weeklyCup,duelSummary} from "../src/v13-discovery.js";

test("debrief reports real accepted answers without invented popularity",()=>{
  const result=dailyDebrief([{id:"a",category:"GEO"},{id:"b",category:"GEO"}],[
    {type:"rare",accepted:"Monaco",valid:true,points:850,category:"GEO"},
    {type:"fit",accepted:"Coffee",valid:true,points:600,category:"EVERYDAY"},
    {type:"rare",valid:false,points:0,category:"GEO"}
  ]);
  assert.equal(result.total,1450);
  assert.equal(result.accepted,2);
  assert.equal(result.bestRare.accepted,"Monaco");
  assert.equal(result.bestFit.accepted,"Coffee");
  assert.equal(result.missed.length,1);
  assert.equal(result.rareTotal,850);
  assert.equal(result.fitTotal,600);
});

test("same UTC week has one deterministic challenge slate and changes on new week",()=>{
  const a=weeklySpotlight("2026-11-13");
  assert.equal(a.id,weeklySpotlight("2026-11-15").id);
  const first=weeklySpotlightRound("2026-11-13").map(q=>q.id);
  const second=weeklySpotlightRound("2026-11-15").map(q=>q.id);
  assert.deepEqual(first,second);
  assert.equal(new Set(first).size,10);
  assert.equal(a.week,"2026-11-09");
  assert.notEqual(weeklySpotlight("2026-11-16").week,a.week);
});

test("weekly exhibition pairs use only verified feed and do not invent a win on a tie",()=>{
  const cup=weeklyCup([{userId:"b",name:"B",score:1200,days:2},
    {userId:"a",name:"A",score:1200,days:2},
    {userId:"c",name:"C",score:0,days:0}],"last-week");
  assert.equal(cup.matchups.length,1);
  assert.equal(cup.matchups[0].draw,true);
  assert.equal(cup.matchups[0].winner,null);
  assert.equal(cup.bye.userId,"c");
  assert.equal(cup.final,true);
});

test("local duel has deterministic scores and does not award ranked points",()=>{
  const one=[{valid:true,points:950},{valid:false,points:0},{valid:true,points:500}];
  const two=[{valid:true,points:600},{valid:true,points:600},{valid:true,points:200}];
  const scores=duelSummary(one,two);
  assert.equal(scores.oneScore,1450);
  assert.equal(scores.twoScore,1400);
  assert.equal(scores.oneAccepted,2);
  assert.equal(scores.twoAccepted,3);
  assert.equal(scores.outcome,"one");
  assert.equal(duelSummary(one,one).outcome,"tie");
});
