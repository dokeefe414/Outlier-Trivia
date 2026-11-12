import test from "node:test";
import assert from "node:assert/strict";
import {answerScorePosition,pointsAudit,scoreExplanation} from "../src/rarity-insights.js";
import {evaluate,matchRare} from "../src/game.js";
import {rareQuestions} from "../src/data.js";

test("answer rank reflects editorial list scoring, not invented player percentiles",()=>{
  const question={answers:[["Common",150],["Moderate",550],["Deep",950],["Deep 2",950]]};
  const info=answerScorePosition(question,"Deep");
  assert.equal(info.position,1);
  assert.equal(info.tied,2);
  assert.equal(info.topPercent,50);
  assert.equal(info.tier.label,"DEEP CUT");
  assert.equal(answerScorePosition(question,"Missing"),null);
});
test("score explanations disclose the editorial basis and alias matching",()=>{
  const q={...rareQuestions.find(q=>q.id==="pack-sports-nba-mvp"),type:"rare"};
  const outcome=evaluate(q,"Steph Curry");
  assert.equal(outcome.accepted,"Stephen Curry");
  assert.equal(outcome.matchKind,"alias");
  const score=scoreExplanation(outcome,q);
  assert.equal(score.match,"Approved alternate name");
  assert.match(score.detail,/APPROVED ANSWER SCORES/);
  assert.match(score.detail,/not a player percentile/);
  assert.equal(scoreExplanation({valid:false,type:"rare"},q),null);
});
test("rarity audit has finite values, stable group counts and no popularity claims",()=>{
  const all=pointsAudit(rareQuestions);
  assert.equal(all.length,105);
  assert.ok(all.every(row=>row.min>=1&&row.max<=1000));
  assert.ok(all.every(row=>row.median>=row.min&&row.median<=row.max));
  assert.ok(all.every(row=>row.caveat.includes("not response-frequency")));
  const mvp=all.find(q=>q.id==="pack-sports-nba-mvp");
  assert.ok(mvp.uniqueTiers>8);
  assert.equal(matchRare(rareQuestions.find(q=>q.id==="pack-sports-nba-mvp"),"Steph Curry")?.points,180);
});
