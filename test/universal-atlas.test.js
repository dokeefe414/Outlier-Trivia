import test from "node:test";
import assert from "node:assert/strict";
import {rareQuestions,fitQuestions} from "../src/data.js";
import {normalizeAnswer,inspectRareGuess,auditQuestionAliases} from "../src/answer-intelligence.js";
import {buildRound,buildArcadeRound,buildOpenAtlasRound,randomFromSeed,seedFromString} from "../src/game.js";
import {buildPartyGames} from "../src/party-duel.js";
import {universalMediaQuestions,universalMediaCounts} from "../src/universal-media-questions.js";
import {universalBaseballQuestions,universalBaseballCount} from "../src/universal-baseball-questions.js";
import {universalMiscQuestions,universalMiscCounts,universalMiscSourceCount} from "../src/universal-misc-questions.js";

const byId=id=>rareQuestions.find(q=>q.id===id);
const status=(id,answer)=>inspectRareGuess(byId(id),answer).status;

test("v1.6 source records and new questions cover all twelve topic groups",()=>{
  assert.deepEqual(universalMediaCounts,
    {film:7716,tv:1818,game:1311,anime:388,manga:307});
  assert.equal(universalBaseballCount,23485);
  assert.equal(universalMiscSourceCount,14543);
  assert.equal(universalMediaQuestions.length,17);
  assert.equal(universalBaseballQuestions.length,6);
  assert.equal(universalMiscQuestions.length,57);
  const all=[...universalMediaQuestions,...universalBaseballQuestions,...universalMiscQuestions];
  assert.equal(all.length,80);
  assert.equal(new Set(all.map(q=>q.id)).size,80);
  assert.deepEqual([...new Set(all.map(q=>q.poolGroup))].sort(),
    ["animals","food","games","geo","history","movies","music","people","science","sports","tv","wild"]);
  assert.ok(all.every(q=>q.arcadeOnly&&q.bigPool&&q.answers.length>=28));
});

test("popular and obscure media share exact archived inclusion rules",()=>{
  assert.equal(status("open-v16-films-1980-1999","Forrest Gump"),"accepted");
  assert.equal(status("open-v16-films-1950-1979","The Godfather"),"accepted");
  assert.equal(status("open-v16-tv-before-2000","Friends"),"accepted");
  assert.equal(status("open-v16-tv-2000-2014","Game of Thrones"),"accepted");
  assert.equal(status("open-v16-videogames-all","Minecraft"),"accepted");
  assert.equal(status("open-v16-videogames-all","Absolutely Fake Video Game 12345"),"unrecognized");
  assert.equal(status("open-v16-films-1950-1979","Forrest Gump"),"unrecognized");
  assert.equal(status("open-v16-anime-all","Spirited Away"),"accepted");
});

test("MLB archive recognizes verified names only inside debut-era windows",()=>{
  assert.equal(status("open-v16-mlb-1871-1919","Babe Ruth"),"accepted");
  assert.equal(status("open-v16-mlb-1920-1949","Jackie Robinson"),"accepted");
  assert.equal(status("open-v16-mlb-1980-1999","Derek Jeter"),"accepted");
  assert.equal(status("open-v16-mlb-2000-2014","Mike Trout"),"accepted");
  assert.equal(status("open-v16-mlb-2015-2026","Shohei Ohtani"),"accepted");
  assert.equal(status("open-v16-mlb-2015-2026","Babe Ruth"),"unrecognized");
  assert.equal(status("open-v16-mlb-2000-2014","Fake Famous Athlete"),"unrecognized");
});

test("CC0 lists broaden music, science, sports, people, food, history and animals",()=>{
  assert.equal(status("open-v16-cc0-actors-all","Emma Watson"),"accepted");
  assert.equal(status("open-v16-cc0-xxl-all","J. Cole"),"accepted");
  assert.equal(status("open-v16-cc0-rpg-all","13th Age"),"accepted");
  assert.equal(status("open-v16-cc0-books-all","The Lord of the Rings"),"accepted");
  assert.equal(status("open-v16-cc0-cats-all","Abyssinian"),"accepted");
  assert.equal(status("open-v16-cc0-colors-all","Alice blue"),"accepted");
  assert.equal(status("open-v16-cc0-actors-all","Completely Imaginary Person 123"),"unrecognized");
});

test("C++, C# and C no longer collapse into the same normalized answer",()=>{
  assert.notEqual(normalizeAnswer("C++"),normalizeAnswer("C#"));
  assert.notEqual(normalizeAnswer("C"),normalizeAnswer("C++"));
  const q=byId("open-v16-cc0-programming-all");
  assert.equal(inspectRareGuess(q,"C++").status,"accepted");
  assert.equal(inspectRareGuess(q,"C#").status,"accepted");
  assert.notEqual(inspectRareGuess(q,"C++").match?.label,inspectRareGuess(q,"C#").match?.label);
});

test("all v1.6 answer sources have distinct canonical IDs and no contradictory aliases",()=>{
  for(const q of [...universalMediaQuestions,...universalBaseballQuestions,...universalMiscQuestions]) {
    const audit=auditQuestionAliases(q);
    assert.deepEqual(audit.collisions,[],q.id);
    assert.deepEqual(audit.invalidPoints,[],q.id);
    assert.ok(audit.answerCount>=28,q.id);
  }
});

test("every Big List game has seven different categories, all new answers stay unranked",()=>{
  for(let i=0;i<10;i++){
    const game=buildOpenAtlasRound();
    assert.equal(game.length,7);
    assert.equal(new Set(game.map(q=>q.id)).size,7);
    assert.equal(new Set(game.map(q=>q.poolGroup)).size,7);
    assert.ok(game.every(q=>q.arcadeOnly&&q.type==="rare"));
  }
  assert.equal(rareQuestions.filter(q=>!q.arcadeOnly).length,137);
  assert.equal(fitQuestions.length,53);
  for(const day of ["2026-11-13","2026-11-14","2026-11-16","2026-11-30"]){
    const official=buildRound(day);
    assert.ok(official.every(q=>!q.arcadeOnly),day);
  }
  const arcade=buildArcadeRound("2026-11-16","music","rare-rush");
  assert.ok(arcade.some(q=>q.arcadeOnly));
  // A single shuffled 4-question slate can legitimately contain only older
  // sports prompts. Test across reproducible seeds, never one lucky draw.
  const config={players:2,games:1,categories:["sports"]};
  let expandedSportsFound=false;
  for(let i=0;i<24;i++){
    const random=randomFromSeed(seedFromString("v16-party-source-"+i));
    const party=buildPartyGames(config,random);
    assert.ok(party[0].questions.filter(q=>q.type==="rare")
      .every(q=>q.poolGroup==="sports"));
    if(party[0].questions.some(q=>q.arcadeOnly))expandedSportsFound=true;
  }
  assert.equal(expandedSportsFound,true);
});
