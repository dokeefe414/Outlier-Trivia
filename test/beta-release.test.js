import test from "node:test";
import assert from "node:assert/strict";
import {validateBetaReport,evaluateBetaReport} from "../src/beta-release.js";
const good=(mode="local")=>({
  mode,started:true,completed:true,wouldPlayAgain:true,reconnectFailures:0,
  validAnswerRejected:0,mobileOverflow:false,privacyIncident:false,
  unauthorizedRematch:false,timerReset:false,officialScoreChanged:false,
  accessibilityIssue:false
});
test("empty, incomplete or too-small real beta samples never qualify for release",()=>{
  let r=evaluateBetaReport({testerCount:0,sessions:[]});
  assert.equal(r.valid,true);
  assert.equal(r.ready,false);
  assert.equal(r.rates.completion,null);
  const nine=Array.from({length:9},()=>good());
  r=evaluateBetaReport({testerCount:9,sessions:nine});
  assert.equal(r.ready,false);
  assert.ok(r.blockers.some(x=>x.includes("Not enough")));
});
test("completed, consenting cross-device testers can meet explicit acceptance gates",()=>{
  const sessions=Array.from({length:11},(_,i)=>good(i%2?"private":"local"));
  const r=evaluateBetaReport({testerCount:11,sessions});
  assert.equal(r.ready,true);
  assert.equal(r.sample.completedPrivate,5);
  assert.equal(r.rates.completion,1);
});
test("even one privacy incident or fraudulent rematch is a hard release blocker",()=>{
  const sessions=Array.from({length:12},()=>good("private"));
  sessions[4].privacyIncident=true;
  sessions[6].unauthorizedRematch=true;
  const r=evaluateBetaReport({testerCount:12,sessions});
  assert.equal(r.ready,false);
  assert.equal(r.incidents.privacy,1);
  assert.equal(r.incidents.unauthorizedRematch,1);
});
test("failed sessions lower the completion denominator; incomplete intent isn't fabricated",()=>{
  const sessions=Array.from({length:12},()=>good());
  sessions[0].completed=false;
  sessions[1].completed=false;
  const r=evaluateBetaReport({testerCount:12,sessions});
  assert.equal(r.ready,false);
  assert.equal(r.rates.completion,10/12);
});
test("private identifying fields, guesses and corrupt observations are rejected",()=>{
  const report={testerCount:10,sessions:[{...good(),email:"tester@host.test",answer:"Secret"}]};
  assert.ok(validateBetaReport(report).some(x=>x.includes("disallowed")));
  assert.equal(evaluateBetaReport(report).valid,false);
  assert.equal(evaluateBetaReport({testerCount:10,sessions:[good()],contactEmail:"secret@example.test"}).valid,false);
  assert.equal(evaluateBetaReport({testerCount:10,sessions:[{...good(),started:false}]}).valid,false);
});
