import test from "node:test";
import assert from "node:assert/strict";
import { rareQuestions, fitQuestions, DAILY_PATTERN } from "../src/data.js";
import {
  buildRound, normalizeAnswer, matchRare, evaluate, scoreOf, lifetimeStats,
  seedFromString, randomFromSeed, getTier, shareText
} from "../src/game.js";

test("every official daily game contains four rare and three fit rounds", () => {
  const today = buildRound("2026-11-12");
  assert.equal(today.length, 7);
  assert.deepEqual(today.map(q=>q.type), DAILY_PATTERN);
  assert.equal(new Set(today.map(q=>q.id)).size, 7);
  assert.deepEqual(buildRound("2026-11-12"), today);
  assert.notDeepEqual(buildRound("2026-11-12").map(q=>q.id), buildRound("2026-11-13").map(q=>q.id));
});

test("question bank is valid and every crowd board totals 100", () => {
  assert.ok(rareQuestions.length >= 14);
  assert.ok(fitQuestions.length >= 10);
  assert.equal(new Set([...rareQuestions,...fitQuestions].map(q=>q.id)).size, rareQuestions.length + fitQuestions.length);
  for (const q of fitQuestions) {
    assert.equal(q.choices.reduce((n,[,share])=>n+share,0),100,q.id);
    assert.equal(new Set(q.choices.map(([name])=>name)).size,q.choices.length);
  }
  for (const q of rareQuestions) {
    assert.ok(q.answers.length >= 4,q.id);
    assert.ok(q.answers.every(a=>a[1]>0 && a[1]<=1000),q.id);
    const allKeys=q.answers.flatMap(([name,,aliases=[]])=>[name,...aliases].map(normalizeAnswer));
    assert.equal(new Set(allKeys).size,allKeys.length,q.id+" duplicate alias");
  }
});

test("Stand Out matches canonical answers, harmless punctuation, aliases, and single-character typos", () => {
  const countries = rareQuestions.find(q=>q.id==="countries-m");
  assert.equal(matchRare(countries,"Micronesia")?.label,"Micronesia");
  assert.equal(matchRare(countries,"Federated States of Micronesia")?.label,"Micronesia");
  assert.equal(matchRare(countries,"Micronesiaa")?.label,"Micronesia");
  assert.equal(matchRare(countries,"London"),null);
  const us = rareQuestions.find(q=>q.id==="un-security");
  assert.equal(matchRare(us,"U.S.A.")?.label,"United States");
});

test("Stand Out scores are fixed; invalid answers get zero", () => {
  const q = rareQuestions.find(q=>q.id==="planets");
  assert.equal(evaluate({...q,type:"rare"},"Uranus").points,900);
  assert.equal(evaluate({...q,type:"rare"},"Jupiter").points,260);
  assert.equal(evaluate({...q,type:"rare"},"Pluto").points,0);
  assert.equal(evaluate({...q,type:"rare"},null).points,0);
});

test("Fit In uses fixed normalized crowd popularity scoring", () => {
  const q = {...fitQuestions.find(q=>q.id==="lose"),type:"fit"};
  const most = evaluate(q,"Keys");
  assert.equal(most.points,1000);
  assert.equal(most.share,38);
  assert.equal(evaluate(q,"Phone").points,Math.round(24/38*1000));
  assert.equal(evaluate(q,"Something else").points,0);
});

test("Lifetime average and total only count complete official records", () => {
  const answers = Array.from({length:7},(_,i)=>({points:500+i*10,valid:true}));
  const day1 = {answers,complete:true};
  const day2 = {answers:answers.map(a=>({...a,points:700})),complete:true};
  const stats = lifetimeStats({"2026-11-11":day1,"2026-11-12":day2,"2026-11-13":{answers:[answers[0]],complete:false}});
  assert.equal(stats.days,2);
  assert.equal(stats.total,scoreOf(answers)+4900);
  assert.equal(stats.average,Math.round(stats.total/2));
  assert.equal(stats.best,4900);
  assert.equal(lifetimeStats({}).days,0);
});

test("Result summaries and sharing have stable, non-spoiling outputs", () => {
  assert.equal(getTier(6000).title,"THE OUTLIER");
  const answers = Array.from({length:7},()=>({points:850,valid:true}));
  assert.equal(scoreOf(answers),5950);
  const shared = shareText("2026-11-12",answers);
  assert.match(shared,/5,950 \/ 7,000/);
  assert.ok(!shared.includes("Micronesia"));
  const seeded = randomFromSeed(seedFromString("check"));
  assert.ok(seeded()>=0 && seeded()<=1);
});
