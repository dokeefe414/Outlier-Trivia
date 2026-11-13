import test from "node:test";
import assert from "node:assert/strict";
import {openAtlasQuestions,openAtlasCatalog} from "../src/open-atlas-questions.js";
import {rareQuestions} from "../src/data.js";
import {inspectRareGuess,auditQuestionAliases} from "../src/answer-intelligence.js";
import {buildRound,buildArcadeRound,buildAtlasRound,buildOpenAtlasRound} from "../src/game.js";
import {buildPartyGames} from "../src/party-duel.js";

const find=id=>openAtlasQuestions.find(q=>q.id===id);

test("CC0 source snapshot is concrete, not a fabricated total",()=>{
  assert.deepEqual([openAtlasCatalog.cityEntries,openAtlasCatalog.countyEntries,
    openAtlasCatalog.dinosaurEntries],[1000,3195,1449]);
  assert.equal(openAtlasCatalog.sourceEntries,5644);
  assert.equal(openAtlasCatalog.prompts,18);
  assert.ok(openAtlasCatalog.answerSlots>10000);
  assert.ok(openAtlasQuestions.every(q=>q.arcadeOnly&&q.bigPool));
});

test("large place catalogs accept official city/state labels and safe shorthands",()=>{
  const cities=find("open-us-city-top1000");
  const counties=find("open-us-county-all");
  assert.equal(inspectRareGuess(cities,"New York, New York").status,"accepted");
  assert.equal(inspectRareGuess(cities,"New York NY").status,"accepted");
  assert.equal(inspectRareGuess(cities,"Los Angeles").status,"accepted");
  assert.equal(inspectRareGuess(cities,"Totally Made Up City").status,"unrecognized");
  assert.equal(inspectRareGuess(counties,"Lackawanna, Pennsylvania").status,"accepted");
  assert.equal(inspectRareGuess(counties,"Lackawanna County PA").status,"accepted");
  // A county name shared across states should require a state qualifier.
  assert.notEqual(inspectRareGuess(counties,"Washington").status,"accepted");
  assert.equal(inspectRareGuess(counties,"Washington, Pennsylvania").status,"accepted");
});

test("specific source constraints are enforced; no cross-category hallucinations",()=>{
  const cityCa=find("open-us-city-ca");
  const countyPa=find("open-us-county-pa");
  assert.equal(inspectRareGuess(cityCa,"Los Angeles").status,"accepted");
  assert.equal(inspectRareGuess(cityCa,"Houston").status,"unrecognized");
  assert.equal(inspectRareGuess(countyPa,"Lackawanna").status,"accepted");
  assert.equal(inspectRareGuess(countyPa,"Cook County").status,"unrecognized");
  const dino=find("open-dinosaur-names");
  assert.equal(inspectRareGuess(dino,"Tyrannosaurus").status,"accepted");
  assert.equal(inspectRareGuess(dino,"Elephant").status,"unrecognized");
});

test("all imported prompts have unique normalized aliases and bounded editorial points",()=>{
  for(const q of openAtlasQuestions){
    const audit=auditQuestionAliases(q);
    assert.deepEqual(audit.collisions,[],q.id);
    assert.deepEqual(audit.invalidPoints,[],q.id);
    assert.ok(audit.answerCount>=28,q.id);
    assert.equal(new Set(q.answers.map(row=>row[0])).size,q.answers.length);
    assert.ok(q.answers.every(row=>row[1]>=1&&row[1]<=1000));
  }
});

test("new broad prompts are available in practice and party, never leak into official day slates",()=>{
  const day="2026-11-16";
  const q=rareQuestions.find(q=>q.id==="open-us-city-top1000");
  assert.ok(q);
  for(let i=0;i<20;i++){
    const official=buildRound(day);
    assert.ok(official.every(q=>!q.arcadeOnly));
  }
  assert.ok(buildAtlasRound("2026-11-12").every(q=>!q.arcadeOnly));
  let found=false;
  for(let i=0;i<100;i++){
    const practice=buildArcadeRound(day,"geo","rare-rush");
    if(practice.some(q=>q.arcadeOnly))found=true;
  }
  assert.ok(found,"new source content should appear in geo practice");
  let foundParty=false;
  for(let i=0;i<100;i++){
    const party=buildPartyGames({players:2,games:1,categories:["geo"]});
    if(party[0].questions.some(q=>q.arcadeOnly))foundParty=true;
  }
  assert.ok(foundParty,"new content should appear in customized party duels");
});

test("The Big List is seven fully open-source-backed rare-answer questions",()=>{
  const round=buildOpenAtlasRound();
  assert.equal(round.length,7);
  assert.equal(new Set(round.map(q=>q.id)).size,7);
  assert.ok(round.every(q=>q.arcadeOnly&&q.type==="rare"));
  assert.ok(round.every(q=>q.answers.length>=28));
  assert.equal(round.length*1000,7000);
});
