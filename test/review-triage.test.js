import test from "node:test";
import assert from "node:assert/strict";
import {triageAnswerCandidates} from "../src/review-triage.js";
const source="https://example.org/reference-entry";
test("bulk triage makes no editorial approval and flags evidence gates",()=>{
  const batch=[
    {questionId:"pack-music-artists",answer:"Stephen Curry",reason:"I think this is plausible",source},
    {questionId:"pack-sports-nba-mvp",answer:"Steph Curry",reason:"NBA source identifies this exact person and MVP.",source},
    {questionId:"pack-sports-nba-mvp",answer:"Steph Curry",reason:"Duplicate report with the same name and same prompt.",source},
    {questionId:"pack-sports-nba-mvp",answer:"Truly Missing Name",reason:"The reference archive contains this name under eligible terms.",source},
    {questionId:"not-existing-question-id",answer:"Test Person",reason:"The reference archive contains an eligible entry.",source}
  ];
  const output=triageAnswerCandidates(batch);
  assert.equal(output.count,5);
  assert.equal(output.items[0].state,"missing_evidence");
  assert.equal(output.items[1].state,"already_approved");
  assert.equal(output.items[2].state,"duplicate_submission");
  assert.equal(output.items[3].state,"ready_for_human_review");
  assert.equal(output.items[4].state,"unknown_question");
  assert.match(output.policy,/No proposal was accepted/);
  assert.equal(output.items[3].accepted,null);
});
test("malicious URLs and oversized bulk inputs never qualify as evidence",()=>{
  const output=triageAnswerCandidates([{
    questionId:"pack-sports-nba-mvp",answer:"New Unknown Player",
    reason:"This text is long enough to explain a proposed match.",
    source:"javascript:alert(1)"
  }]);
  assert.equal(output.items[0].state,"missing_evidence");
  assert.throws(()=>triageAnswerCandidates(Array(251).fill({})));
});
