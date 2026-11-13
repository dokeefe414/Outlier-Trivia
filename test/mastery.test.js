import test from "node:test";
import assert from "node:assert/strict";
import {personalMastery,MASTERY_TROPHIES} from "../src/mastery.js";
const mk=(category="SCIENCE",rare=800)=>({
  complete:true,answers:[
    {type:"rare",category,points:rare,valid:true,accepted:"First"},
    {type:"fit",category:"EVERYDAY",points:1000,valid:true,accepted:"Coffee"},
    {type:"rare",category,points:880,valid:true,accepted:"Second"},
    {type:"fit",category:"EVERYDAY",points:300,valid:true,accepted:"Tea"},
    {type:"rare",category,points:900,valid:true,accepted:"Third"},
    {type:"fit",category:"EVERYDAY",points:700,valid:true,accepted:"Walk"},
    {type:"rare",category,points:1000,valid:true,accepted:"Fourth"}
  ]
});
test("uncompleted daily and unranked practice cannot inflate mastery",()=>{
  const full=mk();const days={"2026-11-12":full,
    "2026-11-13":{...mk(),complete:false},
    practice:{...mk(),complete:false}};
  const result=personalMastery(days);
  assert.equal(result.days,1);
  assert.equal(result.personalBest,5580);
  assert.equal(result.deepCuts,3);
  assert.equal(result.trophyCount>=3,true);
});
test("distinct rare memory, category XP, levels and trophies are deterministic",()=>{
  const d={"2026-11-13":mk(),"2026-11-14":mk()};
  const one=personalMastery(d),two=personalMastery(d);
  assert.deepEqual(one,two);
  assert.equal(one.distinctRare,4);
  assert.equal(one.categories[0].name,"SCIENCE");
  assert.ok(one.categories[0].xp>0);
  assert.equal(one.trophies.find(t=>t.id==="perfect-rare").unlocked,true);
  assert.equal(one.trophies.find(t=>t.id==="deep-cut-5").unlocked,true);
  assert.equal(MASTERY_TROPHIES.length,6);
});
test("invalid rare guesses get no deep-cut credit and category progress remains bounded",()=>{
  const run=mk();run.answers[4]={...run.answers[4],valid:false,accepted:null,points:0};
  const m=personalMastery({"2026-11-13":run});
  assert.equal(m.deepCuts,2);
  assert.ok(m.categories.every(c=>c.progress>=0&&c.progress<=100));
  assert.equal(m.trophies.find(t=>t.id==="perfect-rare").unlocked,false);
});
