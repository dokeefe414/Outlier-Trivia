import test from "node:test";
import assert from "node:assert/strict";
import {reviewImportedCatalog} from "../src/answer-import.js";

const base={
  questionId:"example-science-archive",sourceUrl:"https://example.org/archive",
  license:"CC0",snapshotDate:"2026-11-13",
  answers:[["Triceratops",150,["Trike"]],["Tyrannosaurus",200,["T-Rex"]]]
};
test("bulk import review keeps facts and editorial scores separate",()=>{
  const report=reviewImportedCatalog(base);
  assert.equal(report.uniqueNames,2);
  assert.equal(report.aliasForms,2);
  assert.equal(report.readyForEditorialReview,true);
  assert.equal(report.acceptedIntoGame,false);
});
test("no provenance or malformed score can silently enter a prompt",()=>{
  const report=reviewImportedCatalog({...base,sourceUrl:"file:///tmp/a",license:"",
    answers:[["Mars",-1],["Venus",180,["Mars"]]]});
  assert.equal(report.readyForEditorialReview,false);
  assert.ok(report.issues.length>=2);
});
test("normalized conflicting aliases are caught",()=>{
  const report=reviewImportedCatalog({...base,answers:[
    ["Los Angeles",180,["LA"]],["Louisiana",300,["LA"]]
  ]});
  assert.equal(report.readyForEditorialReview,false);
  assert.ok(report.issues.some(x=>x.includes("aliases conflict")));
});
