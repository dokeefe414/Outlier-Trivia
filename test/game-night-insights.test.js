import test from "node:test";
import assert from "node:assert/strict";
import {ROOM_THEMES,ROOM_TIMERS,ROOM_SERIES,privateGameHighlights,
  privateScoreShareText,earnedPrivateBadges} from "../src/game-night-insights.js";

const players=[{id:"a",name:"Ace"},{id:"b",name:"Bee"}];
function room(phase="finished"){
  return {phase,players,roundSeconds:30,scores:[{id:"a",name:"Ace",score:1100},
    {id:"b",name:"Bee",score:1300}],answers:[
    {index:0,player:"a",accepted:"A",points:600},
    {index:0,player:"b",accepted:"B",points:200},
    {index:1,player:"b",accepted:"C",points:900},
    {index:3,player:"a",accepted:"D",points:500},
    {index:4,player:"b",accepted:"E",points:200}
  ]};
}
test("server-only game configuration presets are bounded",()=>{
  assert.deepEqual(ROOM_TIMERS,[20,30,45,60,90]);
  assert.deepEqual(ROOM_SERIES,[1,3,5]);
  assert.ok(ROOM_THEMES.includes("SCIENCE"));
});
test("private results never render before the shared deadline",()=>{
  assert.equal(privateGameHighlights(room("playing")),null);
  assert.equal(privateScoreShareText(room("waiting")),null);
  assert.equal(privateGameHighlights({phase:"finished"}),null);
});
test("closed-room timeline is cumulative and preserves server scores",()=>{
  const result=privateGameHighlights(room());
  assert.equal(result.rounds.length,7);
  assert.equal(result.rounds[0].scores[0].total,600);
  assert.equal(result.rounds[1].scores[1].total,1100);
  assert.equal(result.highest.answer,"C");
  assert.equal(result.highest.points,900);
  assert.equal(result.winnerNames[0],"Bee");
  assert.equal(result.margin,200);
  assert.equal(result.closeFinish,true);
  assert.ok(result.leadChanges>=1);
});
test("share summary never reveals identities, answer keys or invite codes",()=>{
  const state={...room(),code:"aabbccddeeff",id:"private-room-id"};
  const text=privateScoreShareText(state);
  assert.match(text,/7 rounds · 30 seconds/);
  for(const secret of ["Ace","Bee","private-room-id","aabbccddeeff","accepted"])
    assert.ok(!text.includes(secret),secret);
});
test("badges only unlock against server-reported finished-match stats",()=>{
  const blank=earnedPrivateBadges({});
  assert.equal(blank.filter(x=>x.unlocked).length,0);
  const earned=earnedPrivateBadges({games:10,wins:3,rareHits:5,bestScore:4800});
  assert.equal(earned.filter(x=>x.unlocked).length,5);
});
