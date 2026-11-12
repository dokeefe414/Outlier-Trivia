import test from "node:test";
import assert from "node:assert/strict";
import {arcadeFormats,buildArcadeRound,arcadeMaximum,practiceCategoryOptions,
  buildRound,scoreOf,randomFromSeed,seedFromString,MAX_SCORE} from "../src/game.js";

test("all three arcade formats have correct question counts and score caps",()=>{
  assert.deepEqual(arcadeFormats.map(f=>[f.value,f.rounds,f.seconds]),[
    ["classic",7,45],["quick",3,35],["rare-rush",10,30]
  ]);
  for(const config of arcadeFormats) {
    const questions=buildArcadeRound("2026-11-18","surprise",config.value);
    assert.equal(questions.length,config.rounds);
    assert.equal(arcadeMaximum(questions),config.rounds*1000);
    assert.equal(new Set(questions.map(q=>q.id)).size,config.rounds);
    assert.ok(questions.every((q,i)=>q.index===i));
    if(config.value==="quick")assert.deepEqual(questions.map(q=>q.type),["rare","fit","rare"]);
    if(config.value==="rare-rush")assert.ok(questions.every(q=>q.type==="rare"));
  }
  assert.equal(MAX_SCORE,7000,"the official score remains unchanged");
  assert.equal(buildRound("2026-11-18").length,7);
});
test("every topic can play Quick Hit and Rare Rush without duplicate prompts",()=>{
  for(const topic of practiceCategoryOptions){
    const rng=()=>randomFromSeed(seedFromString(topic.value+":arcade"));
    for(const [format,size] of [["quick",3],["rare-rush",10]]){
      const slate=buildArcadeRound("2026-11-18",topic.value,format,rng());
      assert.equal(slate.length,size,topic.value+" "+format);
      assert.equal(new Set(slate.map(q=>q.id)).size,size,topic.value+" "+format);
      if(topic.value!=="surprise" && format==="quick")
        assert.ok(slate.filter(q=>q.type==="rare").every(q=>q.poolGroup===topic.value));
      if(format==="rare-rush" && topic.value!=="surprise")
        assert.ok(slate.some(q=>q.poolGroup===topic.value),"Rush should feature your selected topic");
    }
  }
});
test("practice formats never modify authoritative daily scores",()=>{
  const fast=buildArcadeRound("2026-11-18","sports","quick");
  const perfect=fast.map(q=>({points:1000,type:q.type,valid:true}));
  assert.equal(scoreOf(perfect),arcadeMaximum(fast));
  assert.equal(scoreOf(perfect),3000);
  assert.throws(()=>buildArcadeRound("2026-11-18","sports","invalid"),/Unknown practice format/);
  const main=buildRound("2026-11-18");
  assert.equal(arcadeMaximum(main),7000);
});
