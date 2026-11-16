import test from "node:test";
import assert from "node:assert/strict";
import {privateTitle,privateSeasonLeaders,cleanRivalryTimeline} from "../src/party-competition.js";
test("verified winning tiers are cosmetic, based only on authoritative season stats",()=>{
  assert.equal(privateTitle(0).name,"CHALLENGER");
  assert.equal(privateTitle(1).name,"FIRST CROWN");
  assert.equal(privateTitle(3).name,"RISING CONTENDER");
  assert.equal(privateTitle(10).name,"SEASON VETERAN");
  assert.equal(privateTitle(25).name,"INNER CIRCLE LEGEND");
});
test("friend league ranking sorts without fabricating tied or missing wins",()=>{
  const list=privateSeasonLeaders([
    {id:"b",name:"Bea",games:2,wins:1,ties:0,losses:1,points:1100},
    {id:"a",name:"Ada",games:2,wins:1,ties:0,losses:1,points:1800},
    {id:"c",name:"Cee",games:2,wins:0,ties:1,losses:1,points:2300},
    {id:"fake",name:"Invalid",games:2,wins:12,ties:0,losses:0,points:4000}
  ]);
  assert.deepEqual(list.map(x=>x.id),["a","b","c"]);
  assert.equal(list[0].seasonLeader,true);
  assert.equal(list[1].seasonLeader,true);
  assert.equal(list[2].seasonLeader,false);
});
test("private rivalry timeline rejects impossible scores, no invented history",()=>{
  const items=cleanRivalryTimeline([
    {startedAt:"2026-11-16T12:00:00Z",you:1500,them:1300,outcome:"win"},
    {startedAt:"2026-11-16T12:00:00Z",you:99999,them:1500,outcome:"win"},
    {startedAt:"2026-11-16T12:00:00Z",you:100,them:100,outcome:"not-defined"}
  ]);
  assert.equal(items.length,1);
  assert.equal(items[0].outcome,"win");
});
