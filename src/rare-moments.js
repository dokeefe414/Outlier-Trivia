// High-energy, spoiler-safe post-answer moment. These counts describe
// approved editorial point values, never observed player popularity.
import {rarityTier} from "./answer-intelligence.js";
export function describeRareMoment(question,result) {
  if(question?.type!=="rare"||!result?.valid||!result.accepted)return null;
  const values=(question.answers||[]).map(([,points])=>Number(points)||0);
  const points=Number(result.points)||0;
  const below=values.filter(score=>score<points).length;
  const tied=values.filter(score=>score===points).length;
  const equalOrHigher=values.filter(score=>score>=points).length;
  const total=values.length;
  if(!total || !tied)return null;
  const tier=rarityTier(points);
  const intensity=points>=950?"legendary":points>=850?"diamond":points>=600?"rare":"standard";
  const tagline=points>=950?"THAT WAS A LEGENDARY PICK":
    points>=850?"YOU FOUND A DEEP CUT":
    points>=600?"YOUR KNOWLEDGE RUNS DEEP":
    points>=350?"AN UNEXPECTED ANSWER":"A CORRECT ANSWER STILL COUNTS";
  const explanation=points>=850
    ?"This pick scores higher than "+below+" of "+total+" approved answer entries."
    :"Your answer is one of "+total+" vetted options for this question.";
  return {
    intensity,tagline,points,tierLabel:tier.label,
    answer:String(result.accepted),total,below,tied,equalOrHigher,
    explanation,
    sourceNote:"Based on our curated answer scores, not real player-popularity data.",
    triggerCelebration:points>=850
  };
}
