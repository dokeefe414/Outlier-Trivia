// OUTLIER editorial bulk triage, NOT a publisher, judge, or new answer bank.
// Local JSON input only; no guesses added to any versioned question catalog.
import {reviewProposal} from "./review-proposal.js";
const safe=(x,n)=>String(x??"").trim().slice(0,n);
const verifiedUrl=value=>{
  try{const u=new URL(value);return u.protocol==="https:"&&u.hostname.includes(".")&&!u.username&&!u.password;}
  catch{return false;}
};
// This is a mechanical scope warning, not a decision on membership in
// the archived reference. It prevents a reviewer from treating a name
// outside a specified first-letter interval as merely a missing alias.
export function firstLetterEligibility(questionId,answer) {
  const id=String(questionId||""),name=String(answer||"").trim().replace(/^the\s+/i,"");
  const first=name.match(/[a-z]/i)?.[0]?.toUpperCase();
  if(!first)return null;
  if(/-am$/.test(id)&&first>"M")return "outside A–M first-letter restriction";
  if(/-nz$/.test(id)&&first<"N")return "outside N–Z first-letter restriction";
  return null;
}
export function triageAnswerCandidates(entries,max=250){
  if(!Array.isArray(entries))throw new Error("Expected an array of review proposals.");
  if(entries.length>max)throw new Error("Too many proposals for one auditable batch.");
  const duplicates=new Set(),items=[];
  for(const [index,record] of entries.entries()){
    const id=safe(record?.questionId,100),candidate=safe(record?.answer,100),
      reason=safe(record?.reason,600),source=safe(record?.source,600);
    const basic=reviewProposal(id,candidate);
    const signature=id+"::"+candidate.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");
    const duplicate=duplicates.has(signature);
    duplicates.add(signature);
    const evidencePresent=verifiedUrl(source)&&reason.length>=40;
    const eligibilityWarning=firstLetterEligibility(id,candidate);
    let state="missing_evidence";
    if(basic.status==="unknown_question")state="unknown_question";
    else if(basic.status==="empty")state="empty";
    else if(duplicate)state="duplicate_submission";
    else if(basic.status==="already_accepted")state="already_approved";
    else if(basic.status==="ambiguous")state="needs_disambiguation";
    else if(eligibilityWarning)state="eligibility_conflict";
    else if(evidencePresent)state="ready_for_human_review";
    items.push({index,questionId:id,answer:candidate,state,
      hasEvidence:evidencePresent,eligibilityWarning,source:verifiedUrl(source)?source:null,
      near:basic.near||[],accepted:basic.accepted||null,
      reviewChecks:basic.reviewChecks||[]});
  }
  const states={};
  for(const item of items)states[item.state]=(states[item.state]||0)+1;
  return {count:items.length,counts:states,items,
    policy:"No proposal was accepted, published, or used to rescore historical results."};
}
