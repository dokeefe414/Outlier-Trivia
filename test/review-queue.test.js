import test from "node:test";
import assert from "node:assert/strict";
import {validateReviewDraft,reviewIssueLink,recordReviewLinkOpened,attachReviewIssue,reviewTicketSummary} from "../src/review-queue.js";
const draft={questionId:"pack-music-artists",question:"Name a performer.",answer:"A correct singer",
  reason:"They are in the exact dated reference list.",source:"https://example.org/singers"};
test("missing evidence cannot be mistaken for accepted answer",()=>{
  assert.equal(validateReviewDraft({...draft,source:"javascript:alert(1)"}).ok,false);
  assert.equal(validateReviewDraft({...draft,reason:"I think so"}).ok,false);
  const link=new URL(reviewIssueLink(draft));
  assert.equal(link.hostname,"github.com");
  assert.match(link.searchParams.get("body"),/Evidence URL: https:\/\/example.org/);
});
test("tracking says link opened, not submitted; verified issue requires correct URL",()=>{
  const rows=recordReviewLinkOpened([],draft,"2026-11-13T00:00:00Z");
  assert.equal(rows[0].status,"issue_link_opened");
  assert.equal(reviewTicketSummary(rows).verified,0);
  assert.throws(()=>attachReviewIssue(rows,0,"https://example.com/issues/5"));
  const saved=attachReviewIssue(rows,0,"https://github.com/dokeefe414/Outlier-Trivia/issues/12");
  assert.equal(saved[0].issueUrl,"https://github.com/dokeefe414/Outlier-Trivia/issues/12");
  assert.equal(reviewTicketSummary(saved).verified,1);
});
