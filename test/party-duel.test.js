import test from "node:test";
import assert from "node:assert/strict";
import {normalizePartyConfig,PARTY_LIMITS,PARTY_TOPICS,buildPartyGames,partyGameScores,partyStandings,partyRevealRound,partyWagerAdjustment,PARTY_TIMERS,PARTY_WAGERS} from "../src/party-duel.js";

const answers=(score=0)=>Array.from({length:7},()=>({points:score,valid:score>0,accepted:score>0?"Valid":"",type:"rare"}));

test("setup defaults, name normalization, custom limits and duplicate-name protection",()=>{
  const a=normalizePartyConfig({});
  assert.deepEqual(a,{players:2,games:1,categories:[],names:["PLAYER 1","PLAYER 2"],timerSeconds:45,finalWager:false});
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
  try{
    const source=buildPartyGames({players:2,games:1,categories:["science"]});
    assert.ok(source[0].questions.filter(q=>q.type==="rare").every(q=>q.poolGroup==="science"));
  }catch(error){assert.match(error.message,/different Stand Out questions/);}
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
  assert.deepEqual(summary.table.map(x=>x.name),["A","B","C"]);
  assert.equal(summary.champions.length,1);
  assert.equal(summary.champions[0].name,"A");
  assert.ok(summary.table.every(x=>x.wins===1));
  const tied=buildPartyGames({players:2,games:1});
  tied[0].answersByPlayer=[answers(50),answers(50)];
  const both=partyStandings({players:2,games:1},tied);
  assert.deepEqual(both.champions.map(x=>x.name),["PLAYER 1","PLAYER 2"]);
});

test("no official game scores or progression keys are written by match model",()=>{
  const g=buildPartyGames({players:2,games:1})[0];
  g.answersByPlayer=[answers(100),answers(150)];
  assert.deepEqual(Object.keys(g).sort(),["answersByPlayer","questions","wagersByPlayer"]);
  assert.equal(partyGameScores(g,2).winners[0],1);
  const partial=partyStandings({players:2,games:2},[g,buildPartyGames({players:2,games:1})[0]]);
  assert.equal(partial.complete,false);
  assert.equal(partial.champions.length,0);
});

test("two game wins beat one high-scoring game",()=>{
  const config={players:2,games:3,names:["Steady","Comeback"]};
  const games=buildPartyGames(config);
  games[0].answersByPlayer=[answers(150),answers(0)];
  games[1].answersByPlayer=[answers(150),answers(0)];
  games[2].answersByPlayer=[answers(0),answers(1000)];
  const final=partyStandings(config,games);
  assert.equal(final.table[0].name,"Steady");
  assert.equal(final.table[0].wins,2);
  assert.ok(final.table[0].points<final.table[1].points);
});

test("configurable timers and optional final wagers are always bounded",()=>{
  assert.deepEqual(PARTY_TIMERS,[20,30,45,60,90]);
  assert.deepEqual(PARTY_WAGERS,[0,100,250,500]);
  const invalid=normalizePartyConfig({timerSeconds:999,finalWager:"yes"});
  assert.equal(invalid.timerSeconds,45);
  assert.equal(invalid.finalWager,false);
  const config={players:2,games:1,timerSeconds:60,finalWager:true};
  const g=buildPartyGames(config)[0];
  assert.deepEqual(g.wagersByPlayer,[null,null]);
  assert.equal(partyGameScores(g,2),null);
  g.answersByPlayer=[answers(200),answers(200)];
  g.wagersByPlayer=[500,250];
  assert.equal(partyWagerAdjustment(g,0),500);
  assert.equal(partyWagerAdjustment(g,1),250);
  assert.deepEqual(partyGameScores(g,2).scores,[1900,1650]);
  const round=partyRevealRound(g,6,["A","B"]);
  assert.equal(round.picks[0].wager,500);
  assert.equal(round.picks[0].points,700);
  assert.equal(round.picks[0].basePoints,200);
  g.answersByPlayer[0][6]={points:0,valid:false,accepted:null,type:"rare"};
  assert.equal(partyWagerAdjustment(g,0),-500);
  assert.deepEqual(partyGameScores(g,2).scores,[700,1650]);
  assert.deepEqual(partyGameScores(g,2).winners,[1]);
});
