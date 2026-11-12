// Editorial rarity feedback. Distinct from measured crowd response frequency.
import {rarityTier} from "./answer-intelligence.js";

export function answerScorePosition(question,acceptedName) {
  const row=(question.answers||[]).find(([name])=>name===acceptedName);
  if(!row)return null;
  const points=row[1],list=question.answers||[];
  const higher=list.filter(([,score])=>score>points).length;
  const equal=list.filter(([,score])=>score===points).length;
  const percentile=Math.max(1,Math.ceil(100*(higher+equal)/list.length));
  return {points,position:higher+1,tied:equal,total:list.length,topPercent:percentile,
    tier:rarityTier(points)};
}
export function pointsAudit(questions) {
  const rows=[];
  for(const question of questions){
    if(!question.bigPool)continue;
    const values=(question.answers||[]).map(row=>row[1]);
    if(!values.length)continue;
    const sorted=[...values].sort((a,b)=>a-b);
    const mean=Math.round(values.reduce((a,b)=>a+b,0)/values.length);
    const median=sorted[Math.floor(sorted.length/2)];
    rows.push({id:question.id,group:question.poolGroup||"legacy",answers:values.length,
      min:sorted[0],max:sorted.at(-1),median,mean,
      uniqueTiers:new Set(values).size,
      caveat:"Editorial scores, not response-frequency measurements."});
  }
  return rows;
}
export function scoreExplanation(result,question) {
  if(!result.valid||result.type!=="rare")return null;
  const rank=answerScorePosition(question,result.accepted);
  return rank?{
    band:rank.tier.label,
    title:rank.tier.message,
    detail:"This answer is tied within the top "+rank.topPercent+
      "% of APPROVED ANSWER SCORES for this question. This is not a player percentile.",
    match:result.matchKind==="alias"?"Approved alternate name":
      result.matchKind==="typo"?"Recognized minor spelling error":"Approved library answer"
  }:null;
}
