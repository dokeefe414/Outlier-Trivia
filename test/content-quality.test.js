import test from "node:test";
import assert from "node:assert/strict";
import {contentQualitySnapshot} from "../src/content-quality.js";
import {rareQuestions,fitQuestions} from "../src/data.js";
test("public content QA summarizes published catalogs without private game data",()=>{
  const report=contentQualitySnapshot(rareQuestions,fitQuestions);
  assert.ok(report.rareQuestions>=230);
  assert.ok(report.fitQuestions>=50);
  assert.ok(report.answerSlots>100000);
  assert.ok(report.aliases>100000);
  assert.equal(report.collisions,0);
  assert.equal(report.invalidScores,0);
  assert.equal(report.warningCount,0);
  assert.ok(report.groupStats.length>=12);
  assert.equal(report.largest.length,16);
  assert.match(report.editorialNotice,/not player probabilities/);
});
test("public quality scanner detects ambiguous aliases and invalid editorial weights",()=>{
  const q={id:"test-bad",poolGroup:"science",
    answers:[["Alpha",100,["one"]],["Beta",120,["one"]],["Gamma",1200]]};
  const r=contentQualitySnapshot([q],[{id:"test-fit",choices:[["A",90],["B",50]]}]);
  assert.ok(r.collisions>=1);
  assert.ok(r.invalidScores>=1);
  assert.ok(r.warnings.some(x=>x.kind==="invalid editorial Fit In weights"));
});
