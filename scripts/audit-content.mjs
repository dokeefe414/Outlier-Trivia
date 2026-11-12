#!/usr/bin/env node
// Local public question-bank audit. Does not contain or print private ranked keys.
import {rareQuestions,fitQuestions} from "../src/data.js";
import {auditQuestionAliases} from "../src/answer-intelligence.js";
import {pointsAudit} from "../src/rarity-insights.js";

const issues=[],ids=new Set();
let accepted=0,alternates=0;
for(const q of [...rareQuestions,...fitQuestions]){
  if(ids.has(q.id))issues.push("Duplicate question ID: "+q.id);
  ids.add(q.id);
  if(q.choices){
    if(q.choices.length!==6||q.choices.reduce((n,[,percent])=>n+percent,0)!==100)
      issues.push("Fit In percentages or option count invalid: "+q.id);
  } else {
    const audit=auditQuestionAliases(q);
    if(audit.collisions.length)issues.push("Ambiguous normalized alias: "+q.id);
    if(audit.invalidPoints.length)issues.push("Invalid rarity points: "+q.id);
    if(q.bigPool && audit.answerCount<28)issues.push("Undersized answer pool: "+q.id);
    accepted+=q.answers.length;
    alternates+=audit.variantCount-q.answers.length;
  }
}
const summaries=pointsAudit(rareQuestions);
if(issues.length){
  issues.slice(0,25).forEach(line=>console.error("FAIL "+line));
  process.exitCode=1;
}
const report={
  status:issues.length?"FAILED":"PASS",
  rarePrompts:rareQuestions.length,fitPrompts:fitQuestions.length,
  acceptedAnswerSlots:accepted,approvedExtraAliases:alternates,
  broadPrompts:summaries.length,
  groups:summaries.reduce((out,row)=>(out[row.group]=(out[row.group]||0)+1,out),{}),
  scoringNote:"Editorial familiarity tiers only; no observed popularity frequency is inferred.",
  issues:issues.length
};
console.log(JSON.stringify(report,null,2));
