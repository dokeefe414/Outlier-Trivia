import test from "node:test";
import assert from "node:assert/strict";
import { rareQuestions, fitQuestions } from "../src/data.js";
import { matchRare, normalizeAnswer, buildRound } from "../src/game.js";

const atlas = rareQuestions.filter(question => question.bigPool);
const byId = id => atlas.find(question => question.id === id);

test("the atlas has 39 broad prompts, with 36–249 approved answers per prompt", () => {
  assert.equal(atlas.length, 39);
  assert.equal(atlas.filter(q=>q.poolGroup==="geo").length,20);
  assert.equal(atlas.filter(q=>q.poolGroup==="science").length,9);
  assert.equal(atlas.filter(q=>q.poolGroup==="wild").length,10);
  assert.equal(Math.min(...atlas.map(q=>q.answers.length)),36);
  assert.equal(Math.max(...atlas.map(q=>q.answers.length)),249);
  assert.ok(atlas.reduce((n,q)=>n+q.answers.length,0)>3700);
  for(const q of atlas) {
    assert.ok(q.answers.length>=35,q.id);
    assert.ok(q.detail.includes(String(q.answers.length)),q.id+" expected valid count");
    const keys=q.answers.flatMap(([name,,aliases=[]])=>[name,...aliases].map(normalizeAnswer));
    assert.equal(new Set(keys).size,keys.length,q.id+" alias collision");
  }
});

test("each official and practice round has four broad questions and three Fit In rounds", () => {
  const days=["2026-11-09","2026-11-10","2026-11-11","2026-11-12","2026-11-13","2026-11-14","2026-11-15"];
  const all=days.map(day=>buildRound(day));
  const ids=all.flatMap(qs=>qs.map(q=>q.id));
  assert.equal(new Set(ids).size,49);
  for(const rounds of all) {
    assert.equal(rounds.length,7);
    const rares=rounds.filter(q=>q.type==="rare");
    assert.deepEqual(rares.map(q=>q.poolGroup).sort(),["geo","geo","science","wild"]);
    assert.ok(rares.every(q=>q.answers.length>=36));
    assert.equal(rounds.filter(q=>q.type==="fit").length,3);
  }
  for(let i=0;i<25;i++) {
    const practice=buildRound("2026-11-12",true);
    assert.ok(practice.filter(q=>q.type==="rare").every(q=>q.bigPool));
    assert.equal(new Set(practice.map(q=>q.id)).size,7);
  }
});

test("country aliases and accepted obscure entities work without blanket guessing",()=>{
  const q=byId("atlas-geo-all");
  assert.equal(matchRare(q,"Côte d'Ivoire")?.label,"Ivory Coast");
  assert.equal(matchRare(q,"Cote dIvoire")?.label,"Ivory Coast");
  assert.equal(matchRare(q,"USA")?.label,"United States");
  assert.equal(matchRare(q,"U.S.A.")?.label,"United States");
  assert.equal(matchRare(q,"Türkiye")?.label,"Turkey");
  assert.equal(matchRare(q,"DR Congo")?.label,"Democratic Republic of the Congo");
  assert.equal(matchRare(q,"Micronesia")?.label,"Micronesia");
  assert.equal(matchRare(q,"Atlantis"),null);
  assert.ok(q.answers.length>=200);
});

test("scientific elements accept spelling alternatives and obscure entries",()=>{
  const q=byId("atlas-science-elements");
  assert.equal(matchRare(q,"Aluminum")?.label,"Aluminium");
  assert.equal(matchRare(q,"Sulphur")?.label,"Sulfur");
  assert.equal(matchRare(q,"Oganesson")?.label,"Oganesson");
  assert.equal(matchRare(q,"Oganessonn")?.label,"Oganesson");
  assert.equal(matchRare(q,"Pluto"),null);
});

test("language, state, state-capital and national-park answers have broad coverage",()=>{
  assert.equal(matchRare(byId("atlas-wild-languages"),"Farsi")?.label,"Persian");
  assert.equal(matchRare(byId("atlas-wild-languages"),"Zulu")?.label,"Zulu");
  assert.equal(matchRare(byId("atlas-wild-states"),"Vermont")?.label,"Vermont");
  assert.equal(matchRare(byId("atlas-wild-capitals"),"Montpelier")?.label,"Montpelier");
  assert.equal(matchRare(byId("atlas-wild-parks"),"Gates of the Arctic")?.label,"Gates of the Arctic");
  assert.equal(matchRare(byId("atlas-wild-parks"),"Yosemite National Park")?.label,"Yosemite");
  assert.equal(matchRare(byId("atlas-wild-parks"),"Atlantis Park"),null);
});
