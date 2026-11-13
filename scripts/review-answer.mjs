#!/usr/bin/env node
// Owner-only public content triage; NEVER writes GitHub or Supabase data.
import {reviewProposal} from "../src/review-proposal.js";
const [questionId,...candidate]=process.argv.slice(2);
if(!questionId||!candidate.length) {
  console.error("Usage: npm run review:answer -- <question-id> <proposed answer>");
  console.error("Example: npm run review:answer -- pack-people-celeb-nz Zendaya");
  process.exitCode=2;
} else {
  const report=reviewProposal(questionId,candidate.join(" "));
  console.log(JSON.stringify(report,null,2));
  if(report.status==="unknown_question"||report.status==="empty") process.exitCode=2;
}
