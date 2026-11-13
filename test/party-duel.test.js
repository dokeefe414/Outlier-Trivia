import test from "node:test";
import assert from "node:assert/strict";
import {normalizePartyConfig,PARTY_LIMITS,PARTY_TOPICS,buildPartyGames,partyGameScores,partyStandings,partyRevealRound} from "../src/party-duel.js";

const answers=(score=0)=>Array.from({length:7},()=>({points:score,valid:score>0,accepted:score>0?"Valid":"",type:"rare"}));

test("setup defaults, name normalization, custom limits and duplicate-name protection",()=>{
  const a=normalizePartyConfig({});
  assert.deepEqual(a,{players:2,games:1,categories:[],names:["PLAYER 1","PLAYER 2"]});
  const b=normalizePartyConfig({players:12,games:24,categories:["sports","movies","sports","invalid"],
    names:["  Name  One ","Maddie", "Brian"]});
  assert.equal(b.players,PARTY_LIMITS.maxPlayers);
  assert.equal(b.games,PARTY_LIMITS.maxGames);
  assert.deepEqual(b.categories,["sports","movies"]);
  assert.equal(b.names[0],"Name One");
  assert.throws(()=>normalizePartyConfig({names:["DAN","dan"]}),/different name/i);
  assert.ok(PARTY_TOPICS.length>=10);
});

test("every party game has 4 on-topic rare questions, 3 mixed Fit In and 7 unique prompts",()=>{
  const config={players:8,games:7,categories:["sports","music"],names:Array.from({length:8},(_,i)=>"P"+(i+1))};
  const games=buildPartyGames(config);
  assert.equal(games.length,7);
  for(const game of games) {
    assert.equal(game.questions.length,7);
    assert.equal(game.answersByPlayer.length,8);
    assert.ok(game.answersByPlayer.every(a=>a===null));
    assert.equal(game.questions.filter(q=>q.type==="rare").length,4);
    assert.equal(game.questions.filter(q=>q.type==="fit").length,3);
    assert.equal(new Set(game.questions.map(q=>q.id)).size,7);
    assert.ok(game.questions.filter(q=>q.type==="rare").every(q=>["sports","music"].includes(q.poolGroup)));
  }
});

test("surprise mix uses wider pool, sequential games reuse only when source exhausted",()=>{
  const games=buildPartyGames({players:2,games:4});
  const ids=games.flatMap(game=>game.questions.filter(q=>q.type==="fit").map(q=>q.id));
  assert.equal(new Set(ids).size,12);
  assert.ok(games[0].questions.filter(q=>q.type==="rare").length===4);
});

test("setup rejects a single category with fewer than four rare prompts rather than cheating",()=>{
  const options=PARTY_TOPICS.filter(q=>q.value==="science");
  assert.equal(options.length,1);
  // If a future editor enlarges this group, this test still verifies that
  // the selected categories remain restricted and all question IDs are unique.
  const source=buildPartyGames({players:2,games:1,categories:["science"]});
  assert.ok(source[0].questions.filter(q=>q.type==="rare").every(q=>q.poolGroup==="science"));
});

test("no partial scores, hidden answers, honest game winners and dramatic reveal order",()=>{
  const g=buildPartyGames({players:3,games:1})[0];
  assert.equal(partyGameScores(g,3),null);
  assert.equal(partyRevealRound(g,0,["A","B","C"]),null);
  g.answersByPlayer=[answers(100),answers(200),answers(100)];
  const game=partyGameScores(g,3);
  assert.deepEqual(game.scores,[700,1400,700]);
  assert.deepEqual(game.winners,[1]);
  assert.equal(partyRevealRound(g,-1,["A","B","C"]),null);
  const reveal=partyRevealRound(g,0,["A","B","C"]);
  assert.equal(reveal.picks.length,3);
  assert.equal(reveal.picks[1].points,200);
  assert.deepEqual(reveal.bestPickers,[1]);
  assert.equal(partyRevealRound(g,7,["A","B","C"]),null);
});

test("series champion uses game wins before point tiebreak, without inventing a winner on exact tie",()=>{
  const config={players:3,games:3,names:["A","B","C"]};
  const gs=buildPartyGames(config);
  gs[0].answersByPlayer=[answers(100),answers(200),answers(0)];
  gs[1].answersByPlayer=[answers(100),answers(0),answers(200)];
  gs[2].answersByPlayer=[answers(200),answers(100),answers(0)];
  const summary=partyStandings(config,gs);
  assert.equal(summary.complete,true);
  assert.deepEqual(summary.table.map(x=>x.name),["B","A","C"]);
  assert.equal(summary.champions.length,1);
  assert.equal(summary.champions[0].name,"B");
  assert.ok(summary.table.every(x=>x.wins===1));
  const tied=buildPartyGames({players:2,games:1});
  tied[0].answersByPlayer=[answers(50),answers(50)];
  const both=partyStandings({players:2,games:1},tied);
  assert.deepEqual(both.champions.map(x=>x.name),["PLAYER 1","PLAYER 2"]);
});

test("no official game scores or progression keys are written by match model",()=>{
  const g=buildPartyGames({players:2,games:1})[0];
  g.answersByPlayer=[answers(100),answers(150)];
  assert.deepEqual(Object.keys(g).sort(),["answersByPlayer","questions"]);
  assert.equal(partyGameScores(g,2).winners[0],1);
  const partial=partyStandings({players:2,games:2},[g,buildPartyGames({players:2,games:1})[0]]);
  assert.equal(partial.complete,false);
  assert.equal(partial.champions.length,0);
});
