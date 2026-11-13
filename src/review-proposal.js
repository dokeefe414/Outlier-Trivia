// Editorial triage helper. This is not an answer-acceptance engine.
// Human verification against the prompt's named source remains mandatory.
import {inspectRareGuess,normalizeAnswer,indexQuestion} from "./answer-intelligence.js";
import {rareQuestions} from "./data.js";

export function reviewProposal(questionId,rawCandidate) {
  const question=rareQuestions.find(q=>q.id===questionId);
  if(!question)return {status:"unknown_question",questionId};
  const candidate=String(rawCandidate??"").trim().slice(0,100);
  const normalized=normalizeAnswer(candidate);
  if(!normalized)return {status:"empty",questionId,question:question.prompt};
  const inspection=inspectRareGuess(question,candidate);
  const variants=indexQuestion(question).variants;
  const near=variants.filter(v=>
      v.key.startsWith(normalized.slice(0,Math.min(4,normalized.length)))||
      normalized.startsWith(v.key.slice(0,Math.min(4,v.key.length))))
    .sort((a,b)=>Math.abs(a.key.length-normalized.length)-Math.abs(b.key.length-normalized.length))
    .map(v=>v.label).filter((v,i,array)=>array.indexOf(v)===i).slice(0,5);
  if(inspection.match) {
    return {status:"already_accepted",questionId,question:question.prompt,candidate,
      accepted:inspection.match.label,matchKind:inspection.match.matchKind,
      points:inspection.match.points,near};
  }
  return {status:inspection.status==="ambiguous"?"ambiguous":"needs_evidence",
    questionId,question:question.prompt,candidate,near,
    reviewChecks:[
      "Does this answer belong to the finite approved reference named in the prompt?",
      "Does it match the precise date, historical season, place, or eligibility restrictions?",
      "Is an authoritative, directly relevant source URL supplied?",
      "Could its normalized name or nickname refer to another accepted answer?",
      "If approved, is a new versioned private ranked question required for future days?"
    ],
    policy:"Do not auto-accept, update sealed daily scores, or introduce broad fuzzy matching."
  };
}
