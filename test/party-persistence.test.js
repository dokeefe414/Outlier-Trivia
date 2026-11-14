import test from "node:test";
import assert from "node:assert/strict";
import {buildPartyGames,partyGameScores} from "../src/party-duel.js";
import {rareQuestions,fitQuestions} from "../src/data.js";
import {serializeParty,restoreParty,summarizePartyArchive,addPartyArchive,PARTY_SAVE_VERSION} from "../src/party-persistence.js";
const now=Date.parse("2026-11-13T20:00:00Z");
const config={players:2,games:2,categories:["sports"],names:["Ada","Bea"],timerSeconds:90,finalWager:true};
const makeAnswer=(q,points=100)=>({
  questionId:q.id,type:q.type,category:q.category,
  points,valid:points>0,accepted:points>0?"Example":null,response:"Example"
});
const fixture=()=>{
  const games=buildPartyGames(config,()=>.5);
  const d={id:"match-id-abc123",createdAt:now,config,games,gameIndex:0,playerIndex:0,revealIndex:-1};
  return {mode:"duel",day:"2026-11-13",questions:games[0].questions,index:0,answers:[],deadline:null,duel:d};
};
const bank=[...rareQuestions,...fitQuestions];

test("checkpoint saves IDs, not enormous answer banks, and restores the exact seven-question slate",()=>{
  const session=fixture(),start=serializeParty(session,"duel-ready",now,now);
  assert.equal(start.version,PARTY_SAVE_VERSION);
  assert.equal(start.games[0].questionIds.length,7);
  assert.equal(JSON.stringify(start).length<6000,true);
  assert.equal(JSON.stringify(start).includes('"answers":['),true);
  const restored=restoreParty(start,bank,now);
  assert.deepEqual(restored.session.questions.map(q=>q.id),session.questions.map(q=>q.id));
  assert.equal(restored.session.duel.config.timerSeconds,90);
  assert.equal(restored.stage,"duel-ready");
});
test("live countdown survives reload without a new 90-second timer",()=>{
  const s=fixture();
  s.deadline=now+31000;
  const saved=serializeParty(s,"game",now,now);
  const resumed=restoreParty(saved,bank,now+8000);
  assert.equal(resumed.session.deadline,now+31000);
  const expired=restoreParty(saved,bank,now+45000);
  assert.equal(expired.session.deadline,now+31000,"expired clock must not reset");
});
test("sealed wager, current answers, handoff and reveal progress survive the checkpoint",()=>{
  const s=fixture();
  for(let i=0;i<6;i++)s.answers.push(makeAnswer(s.questions[i]));
  s.index=6;s.duel.games[0].wagersByPlayer[0]=null;
  let saved=serializeParty(s,"duel-wager",now,now);
  assert.equal(restoreParty(saved,bank,now)?.stage,"duel-wager");
  s.duel.games[0].wagersByPlayer[0]=250;s.deadline=now+51000;
  saved=serializeParty(s,"game",now,now);
  assert.equal(restoreParty(saved,bank,now)?.session.duel.games[0].wagersByPlayer[0],250);
  s.answers.push(makeAnswer(s.questions[6],900));s.index=7;s.deadline=null;
  s.duel.games[0].answersByPlayer[0]=s.answers.map(x=>({...x}));
  saved=serializeParty(s,"duel-handoff",now,now);
  assert.equal(restoreParty(saved,bank,now).stage,"duel-handoff");
  s.duel.playerIndex=1;s.answers=s.questions.map(q=>makeAnswer(q,150));
  s.duel.games[0].answersByPlayer[1]=s.answers.map(x=>({...x}));
  s.duel.games[0].wagersByPlayer[1]=500;
  s.duel.revealIndex=3;
  saved=serializeParty(s,"duel-reveal",now,now);
  const restored=restoreParty(saved,bank,now);
  assert.equal(restored.session.duel.revealIndex,3);
  assert.deepEqual(partyGameScores(restored.session.duel.games[0],2).scores,[1750,1550]);
});
test("corrupt version, unknown questions and malformed scores fail closed",()=>{
  const s=fixture();const saved=serializeParty(s,"duel-ready",now,now);
  assert.equal(restoreParty({...saved,version:1337},bank,now),null);
  assert.equal(restoreParty({...saved,createdAt:now-50*86400000},bank,now),null);
  assert.equal(restoreParty({...saved,stage:"arbitrary"},bank,now),null);
  assert.equal(restoreParty({...saved,games:[{...saved.games[0],questionIds:Array(7).fill("missing")},saved.games[1]]},bank,now),null);
  assert.equal(restoreParty({...saved,index:100},bank,now),null);
  assert.equal(restoreParty({...saved,deadline:now+500000},bank,now),null);
});
test("championship archive contains ONLY summarized standings and is bounded with stable id",()=>{
  const s=fixture();
  for(const game of s.duel.games){
    game.answersByPlayer=[game.questions.map(q=>makeAnswer(q,300)),
      game.questions.map(q=>makeAnswer(q,200))];
    game.wagersByPlayer=[0,0];
  }
  const entry=summarizePartyArchive(s,now);
  assert.deepEqual(entry.champions,["Ada"]);
  assert.equal(entry.gameScores.length,2);
  assert.equal(JSON.stringify(entry).includes("answersByPlayer"),false);
  let history=[];
  for(let i=0;i<30;i++)history=addPartyArchive(history,{...entry,id:"match-"+i});
  assert.equal(history.length,12);
  assert.equal(addPartyArchive(history,history[0]).length,12);
  assert.equal(addPartyArchive(history,history[0]).filter(x=>x.id===history[0].id).length,1);
});
