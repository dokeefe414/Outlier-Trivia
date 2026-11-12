// Spoiler-free friend challenges and personal category insights.
// Shared challenge targets are user-provided, not verified global rankings.
export function readFriendChallenge(search, currentDay) {
  const params = new URLSearchParams(search);
  const scoreText = params.get("beat");
  const day = params.get("day");
  if (!scoreText || !/^\d{1,4}$/.test(scoreText)) return null;
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(day+"T00:00:00.000Z");
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0,10)!==day) return null;
  const score = Number(scoreText);
  if (!Number.isInteger(score) || score<0 || score>7000) return null;
  return {score,day,current:day===currentDay};
}
export function challengeLink(base,day,score) {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  url.searchParams.set("beat",String(Math.max(0,Math.min(7000,Math.round(score)))));
  url.searchParams.set("day",day);
  return url.toString();
}
export function challengeOutcome(challenge,day,score) {
  if (!challenge || challenge.day!==day) return null;
  const margin = score - challenge.score;
  return {
    won:margin>0,tied:margin===0,margin:Math.abs(margin),
    label:margin>0?"YOU BEAT THE CHALLENGE!":margin===0?"YOU MATCHED THE CHALLENGE!":"THE CHALLENGE WINS THIS TIME",
    message:margin>0?"You won by "+margin.toLocaleString("en-US")+" points.":
      margin===0?"A perfect tie. Challenge a friend of your own.":
        "You were "+(-margin).toLocaleString("en-US")+" points away."
  };
}
export function categoryInsights(days) {
  const groups = new Map();
  for (const record of Object.values(days??{})) {
    if (!record?.complete || !Array.isArray(record.answers) || record.answers.length!==7) continue;
    for (const answer of record.answers) {
      const category = String(answer.category||"OTHER").toUpperCase();
      const group = groups.get(category)||{name:category,attempts:0,points:0,correct:0};
      group.attempts++;
      group.points+=Math.max(0,Math.min(1000,Number(answer.points)||0));
      group.correct+=answer.valid?1:0;
      groups.set(category,group);
    }
  }
  return [...groups.values()].map(g=>({
    ...g,average:Math.round(g.points/g.attempts),accuracy:Math.round(g.correct/g.attempts*100)
  })).sort((a,b)=>b.attempts-a.attempts || b.average-a.average || a.name.localeCompare(b.name));
}
