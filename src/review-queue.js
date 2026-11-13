// Evidence-first answer review. A browser link is NOT an accepted submission.
// Never change answer keys, archived daily scores or editorial points here.
const target="https://github.com/dokeefe414/Outlier-Trivia/issues/new";
const idPattern=/^[a-z0-9][a-z0-9-]{2,99}$/;
const safe=(v,max)=>String(v??"").replace(/[\x00-\x1f\x7f]/g," ").trim().slice(0,max);
export function validateReviewDraft(data={}) {
  const questionId=safe(data.questionId,100);
  const answer=safe(data.answer,80);
  const reason=safe(data.reason,500);
  const source=safe(data.source,500);
  let url=null;
  try {url=new URL(source);}catch{}
  const errors=[];
  if(!idPattern.test(questionId))errors.push("Choose a valid question ID.");
  if(answer.length<2)errors.push("Enter the missing answer (at least two characters).");
  if(reason.length<20)errors.push("Explain why this answer qualifies (20+ characters).");
  if(!url||url.protocol!=="https:"||!url.hostname.includes(".")||
      url.username||url.password)errors.push("Provide an HTTPS source showing the answer qualifies.");
  return {ok:errors.length===0,errors,questionId,answer,reason,source};
}
export function reviewIssueLink(data) {
  const v=validateReviewDraft(data);
  if(!v.ok)throw new Error(v.errors[0]);
  const url=new URL(target);
  url.searchParams.set("title","Answer review: "+v.questionId+" / "+v.answer);
  url.searchParams.set("body",
    "Question ID: "+v.questionId+"\n"+
    "Question: "+safe(data.question,250)+"\n"+
    "Proposed answer: "+v.answer+"\n"+
    "Why it qualifies under the exact question: "+v.reason+"\n"+
    "Evidence URL: "+v.source+"\n\n"+
    "Requesting human source verification only. Do not change historical scores.\n"+
    "No private user information is needed.");
  return url.href;
}
export function recordReviewLinkOpened(records=[],draft={},timestamp="") {
  const v=validateReviewDraft(draft);
  if(!v.ok)throw new Error(v.errors.join(" "));
  const old=Array.isArray(records)?records:[];
  return [{questionId:v.questionId,answer:v.answer,source:v.source,
    openedAt:timestamp||new Date().toISOString(),status:"issue_link_opened",
    issueUrl:null},...old.filter(r=>r.questionId!==v.questionId||
    r.answer?.toLowerCase()!==v.answer.toLowerCase()).slice(0,39)];
}
export function reviewTicketSummary(records=[]) {
  const items=Array.isArray(records)?records.slice(0,40):[];
  return {opened:items.length,verified:items.filter(r=>r.status==="verified_issue").length,items};
}
export function attachReviewIssue(records,index,link) {
  const url=String(link||"").trim();
  const match=url.match(/^https:\/\/github\.com\/dokeefe414\/Outlier-Trivia\/issues\/(\d+)(?:[/?#].*)?$/i);
  if(!match)throw new Error("Paste a real OUTLIER GitHub issue URL.");
  const number=Number(match[1]);
  if(!Number.isSafeInteger(number)||number<1)throw new Error("Invalid issue number.");
  const updated=(Array.isArray(records)?records:[]).map((item,i)=>
    i===index?{...item,issueUrl:"https://github.com/dokeefe414/Outlier-Trivia/issues/"+number,
      status:"verified_issue"}:item);
  if(index<0||index>=updated.length)throw new Error("Unknown review record.");
  return updated;
}
