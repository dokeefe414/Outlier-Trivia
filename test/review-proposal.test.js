import test from "node:test";
import assert from "node:assert/strict";
import {reviewProposal} from "../src/review-proposal.js";

test("already-approved aliases are not silently duplicated",()=>{
  const a=reviewProposal("planets","earth");
  assert.equal(a.status,"already_accepted");
  assert.equal(a.accepted,"Earth");
  assert.equal(a.points,100);
});
test("new proposals need evidence and never become accepted by guessing",()=>{
  const a=reviewProposal("planets","Pluto");
  assert.equal(a.status,"needs_evidence");
  assert.ok(a.reviewChecks.some(text=>text.includes("eligibility")));
  assert.match(a.policy,/Do not auto-accept/);
});
test("bad question IDs and missing guesses have explicit statuses",()=>{
  assert.equal(reviewProposal("no-such-id","Z").status,"unknown_question");
  assert.equal(reviewProposal("planets","  ").status,"empty");
});
