// OUTLIER release measurement: explicit, anonymous, manually collected beta data.
// No automatic analytics, usernames, IP addresses, emails or answers.
export const BETA_RELEASE_TARGETS=Object.freeze({
  minConsentingTesters:10,minCompletedSessions:10,
  completionRatio:0.9,replayIntentRatio:0.8
});
const MODES=new Set(["local","private"]);
const isRecord=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const allowed=new Set(["mode","started","completed","wouldPlayAgain","reconnectFailures",
  "validAnswerRejected","mobileOverflow","privacyIncident","unauthorizedRematch",
  "timerReset","officialScoreChanged","accessibilityIssue"]);
const isCount=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000;
const flag=n=>typeof n==="boolean";
export function validateBetaReport(input){
  const errors=[];
  if(!isRecord(input))return ["Expected a JSON object with testerCount and sessions."];
  if(!isCount(input.testerCount)||input.testerCount>1000)
    errors.push("testerCount must be an integer between 0 and 1000; count distinct consenting people offline.");
  if(!Array.isArray(input.sessions)||input.sessions.length>1000)
    return [...errors,"sessions must be an array of at most 1000 anonymous reports."];
  for(const [index,s] of input.sessions.entries()){
    const prefix="sessions["+index+"]";
    if(!isRecord(s)){errors.push(prefix+" must be an object.");continue;}
    for(const key of Object.keys(s))if(!allowed.has(key))
      errors.push(prefix+" contains a disallowed field '"+key+"'; do not add names, user IDs, tokens or raw answers.");
    if(!MODES.has(s.mode))errors.push(prefix+" mode must be local or private.");
    for(const field of ["started","completed","wouldPlayAgain","mobileOverflow","privacyIncident",
      "unauthorizedRematch","timerReset","officialScoreChanged","accessibilityIssue"])
      if(!flag(s[field]))errors.push(prefix+"."+field+" must be true or false.");
    for(const field of ["reconnectFailures","validAnswerRejected"])
      if(!isCount(s[field]))errors.push(prefix+"."+field+" must be a nonnegative integer.");
    if(s.completed&&!s.started)errors.push(prefix+" cannot complete a session that never started.");
  }
  return errors.slice(0,35);
}
export function evaluateBetaReport(input){
  const errors=validateBetaReport(input);
  if(errors.length)return {valid:false,errors,ready:false};
  const sessions=input.sessions,started=sessions.filter(s=>s.started),
    completed=started.filter(s=>s.completed);
  const participants=input.testerCount, total=started.length,
    enough=participants>=BETA_RELEASE_TARGETS.minConsentingTesters&&
      completed.length>=BETA_RELEASE_TARGETS.minCompletedSessions;
  const completionRatio=total?completed.length/total:null;
  // Asking intent after every session avoids falsely counting nonrespondents
  // as either positive or negative. Only completed sessions contribute.
  const positive=completed.filter(s=>s.wouldPlayAgain).length;
  const replayIntentRatio=completed.length?positive/completed.length:null;
  const tally=key=>sessions.reduce((n,s)=>n+(typeof s[key]==="boolean"?Number(s[key]):s[key]),0);
  const incidents={
    privacy:tally("privacyIncident"),unauthorizedRematch:tally("unauthorizedRematch"),
    timerReset:tally("timerReset"),officialScoreChanged:tally("officialScoreChanged"),
    reconnectFailures:tally("reconnectFailures"),validAnswerRejected:tally("validAnswerRejected"),
    mobileOverflow:tally("mobileOverflow"),accessibilityIssues:tally("accessibilityIssue")
  };
  const blockers=[];
  if(!enough)blockers.push("Not enough consenting testers and completed sessions; this is not a public beta result.");
  if(completionRatio===null||completionRatio<BETA_RELEASE_TARGETS.completionRatio)
    blockers.push("Completion rate below the 90% acceptance target.");
  if(replayIntentRatio===null||replayIntentRatio<BETA_RELEASE_TARGETS.replayIntentRatio)
    blockers.push("Would-play-again intent below the 80% acceptance target.");
  for(const [key,value] of Object.entries(incidents)){
    if(["privacy","unauthorizedRematch","timerReset","officialScoreChanged"].includes(key)&&value>0)
      blockers.push("Critical integrity/safety incident: "+key+" ("+value+").");
  }
  if(incidents.validAnswerRejected>0)blockers.push("Unresolved answer rejection reports require source review.");
  return {valid:true,ready:blockers.length===0,blockers,
    sample:{consentingTesters:participants,reportedSessions:sessions.length,
      started:total,completed:completed.length,completedLocal:completed.filter(s=>s.mode==="local").length,
      completedPrivate:completed.filter(s=>s.mode==="private").length,
      positiveReplayIntent:positive},
    rates:{completion:completionRatio,replayIntent:replayIntentRatio},
    incidents,targets:BETA_RELEASE_TARGETS,
    limitation:"Self-reported beta observations; this does not prove online deployment, account uniqueness, or fraud resistance."};
}
