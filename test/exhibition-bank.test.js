import test from "node:test";
import assert from "node:assert/strict";
import {buildExhibitionBank,EXHIBITION_FIT_SAMPLES,EXHIBITION_RARE_IDS} from "../src/exhibition-bank.js";
import {rareQuestions,fitQuestions} from "../src/data.js";
import {auditQuestionAliases,normalizeAnswer} from "../src/answer-intelligence.js";
test("separate exhibition pack uses only source-bounded archived arcade prompts",()=>{
  const bank=buildExhibitionBank();
  assert.ok(bank.length>=100,`Only ${bank.length} exhibition questions`);
  assert.ok(bank.filter(q=>q.kind==="rare").length>=58);
  assert.ok(bank.filter(q=>q.kind==="fit").length>=42);
  assert.equal(new Set(bank.map(q=>q.id)).size,bank.length);
  for(const id of EXHIBITION_RARE_IDS){
    const q=rareQuestions.find(x=>x.id===id);
    assert.equal(q?.arcadeOnly,true,id);
    assert.equal(q?.bigPool,true,id);
    assert.ok(q?.answers?.length>=28,id);
  }
  for(const q of bank){
    assert.ok(!rareQuestions.some(x=>x.id===q.id));
    assert.ok(!fitQuestions.some(x=>x.id===q.id));
    assert.ok(q.detail.length>0);
    if(q.kind==="rare"){
      assert.ok(q.answers.length>=28);
      const audit=auditQuestionAliases(q);
      assert.deepEqual(audit.collisions,[],q.id);
      assert.deepEqual(audit.invalidPoints,[],q.id);
    }else{
      assert.equal(q.choices.length,6);
      assert.equal(q.choices.reduce((n,x)=>n+x[1],0),100);
      assert.equal(new Set(q.choices.map(x=>normalizeAnswer(x[0]))).size,6);
      assert.match(q.detail,/editorial preference weights/);
    }
  }
});
test("exhibition weights never impersonate actual crowd survey percentages",()=>{
  assert.ok(EXHIBITION_FIT_SAMPLES.length>=42);
  assert.ok(EXHIBITION_FIT_SAMPLES.every(q=>q.source.includes("editorial")));
  assert.ok(EXHIBITION_FIT_SAMPLES.every(q=>q.kind==="fit"));

});
