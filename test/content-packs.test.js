import test from "node:test";
import assert from "node:assert/strict";
import { contentPackQuestions, contentPackCatalogCounts } from "../src/content-packs.js";
import { extraFitQuestions } from "../src/fit-expansion.js";
import { rareQuestions, fitQuestions } from "../src/data.js";
import { buildRound, buildAtlasRound, practiceCategoryOptions, dailyCategorySchedule, matchRare, normalizeAnswer } from "../src/game.js";

const group=(g)=>contentPackQuestions.filter(q=>q.poolGroup===g);
const q=(id)=>contentPackQuestions.find(q=>q.id==="pack-"+id);
const has=(question,answer)=>matchRare({...question,type:"rare"},answer);

test("all 66 topical prompts have substantial valid sets and stable unique aliases",()=>{
  assert.equal(contentPackQuestions.length,66);
  assert.equal(rareQuestions.length,137);
  assert.ok(contentPackQuestions.every(x=>x.bigPool));
  assert.ok(contentPackQuestions.every(x=>x.answers.length>=28));
  assert.equal(contentPackQuestions.reduce((total,x)=>total+x.answers.length,0),19821);
  assert.ok(Math.max(...contentPackQuestions.map(x=>x.answers.length))>=990);
  assert.ok(contentPackCatalogCounts.tv>900);
  assert.ok(contentPackCatalogCounts.birds>900);
  for(const x of contentPackQuestions){
    assert.ok(x.detail.includes(String(x.answers.length)),x.id);
    const keys=x.answers.flatMap(([name,points,aliases=[]])=>{
      assert.ok(points>=100 && points<=1000,"score out of range "+x.id);
      return [name,...aliases].map(normalizeAnswer);
    });
    assert.equal(new Set(keys).size,keys.length,x.id+" ambiguous alias or duplicate");
  }
});

test("new topic packs cover the requested entertainment, nature, sports and food",()=>{
  assert.equal(group("movies").length,7);
  assert.equal(group("tv").length,6);
  assert.equal(group("music").length,10);
  assert.equal(group("sports").length,9);
  assert.equal(group("animals").length,12);
  assert.equal(group("food").length,6);
  assert.equal(group("games").length,7);
  assert.equal(group("history").length,5);
  assert.equal(group("people").length,4);
  assert.equal(has(q("movies-all"),"The Godfather")?.label,"The Godfather");
  assert.ok(has(q("tv-all"),"Breaking Bad") || has(q("tv-all"),"Friends"));
  assert.ok(has(q("music-artists"),"Nirvana"));
  assert.equal(has(q("sports-football"),"Dallas Cowboys")?.label,"Dallas Cowboys");
  assert.equal(has(q("animals-dogs"),"Golden Retriever")?.label,"Golden Retriever");
  assert.equal(has(q("animals-birds"),"House Sparrow")?.label,"House Sparrow");
  assert.equal(has(q("games-pokemon"),"Pikachu")?.label,"Pikachu");
  assert.equal(has(q("food-produce"),"broccoli")?.label.toLowerCase(),"broccoli");
  assert.equal(has(q("history-scientists"),"Ada Lovelace")?.label,"Ada Lovelace");
  assert.equal(has(q("movies-all"),"A totally invented movie title"),null);
});

test("all 30 new crowd boards have six distinct response options that sum to 100",()=>{
  assert.equal(extraFitQuestions.length,30);
  assert.equal(fitQuestions.length,53);
  for(const item of extraFitQuestions){
    assert.equal(item.choices.length,6,item.id);
    assert.equal(item.choices.reduce((sum,[,v])=>sum+v,0),100,item.id);
    assert.equal(new Set(item.choices.map(([label])=>normalizeAnswer(label))).size,6,item.id);
  }
});

test("v0.5 daily schedule is varied, deterministic and never repeats a prompt in one week",()=>{
  const days=Array.from({length:7},(_,i)=>"2026-11-"+(16+i));
  const rounds=days.map(day=>buildRound(day));
  assert.deepEqual(buildRound(days[2]),rounds[2]);
  assert.equal(dailyCategorySchedule.length,7);
  assert.equal(new Set(rounds.flatMap(slate=>slate.map(q=>q.id))).size,49);
  for(let i=0;i<7;i++){
    const slate=rounds[i], rare=slate.filter(q=>q.type==="rare");
    assert.equal(rare.length,4);
    assert.equal(slate.filter(q=>q.type==="fit").length,3);
    assert.equal(new Set(rare.map(q=>q.poolGroup)).size,4);
    assert.deepEqual([...rare.map(q=>q.poolGroup)].sort(),[...dailyCategorySchedule[i]].sort());
    assert.ok(rare.every(x=>x.answers.length>=28));
  }
  assert.deepEqual(buildRound("2026-11-12"),buildAtlasRound("2026-11-12"),"preserve v0.4 launch day");
});

test("practice mode can generate every topic without affecting daily scheduling",()=>{
  for(const option of practiceCategoryOptions){
    const category=option.value;
    for(let i=0;i<4;i++){
      const slate=buildRound("2026-11-16",true,category);
      const rare=slate.filter(q=>q.type==="rare");
      assert.equal(rare.length,4,category);
      assert.equal(new Set(slate.map(q=>q.id)).size,7,category);
      assert.ok(rare.every(q=>q.bigPool),category);
      if(category!=="surprise") assert.ok(rare.every(q=>q.poolGroup===category),category);
    }
  }
});
