// OUTLIER v1.8 — compact, versioned, local-only party checkpoints.
// Store question IDs, never 100k+ answer arrays. Never touch official daily
// records. This is convenience recovery, NOT a tamper-proof ranked record.
import {normalizePartyConfig,partyStandings,PARTY_WAGERS} from "./party-duel.js";
export const PARTY_SAVE_KEY="outlier-party-v2";
export const PARTY_SAVE_VERSION=2;
export const PARTY_ARCHIVE_LIMIT=12;
export const PARTY_MAX_AGE_MS=45*24*60*60*1000;
const STAGES=new Set(["duel-ready","game","feedback","duel-handoff","duel-wager",
  "duel-reveal","duel-game-results","duel-champion"]);
const isObj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const inRange=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
const validDate=n=>Number.isFinite(n)&&n>0;
const safeAnswer=x=>isObj(x)&&Number.isInteger(x.points)&&x.points>=0&&x.points<=1000&&
  typeof x.valid==="boolean"&&["rare","fit"].includes(x.type)&&
  (x.accepted==null||typeof x.accepted==="string")&&
  (x.response==null||typeof x.response==="string");
const validAnswers=(rows,count,questions=[])=>Array.isArray(rows)&&rows.length===count&&
  rows.every((answer,i)=>safeAnswer(answer)&&(!questions.length||
    (answer.questionId===questions[i]?.id&&answer.type===questions[i]?.type)));
const compactAnswer=x=>({
  questionId:String(x.questionId||"").slice(0,110),type:x.type,
  category:String(x.category||"").slice(0,80),
  points:x.points,valid:x.valid,
  response:x.response==null?null:String(x.response).slice(0,100),
  accepted:x.accepted==null?null:String(x.accepted).slice(0,120),
  share:x.share??null
});
export function serializeParty(session,stage,createdAt=Date.now(),now=Date.now()){
  if(session?.mode!=="duel"||!session.duel||!STAGES.has(stage))return null;
  const {config,games,gameIndex,playerIndex,revealIndex,id}=session.duel;
  const c=normalizePartyConfig(config);
  if(!Array.isArray(games)||games.length!==c.games||!inRange(gameIndex,0,c.games-1)||
    !inRange(playerIndex,0,c.players-1)||!inRange(revealIndex,-1,6))return null;
  if(!Array.isArray(session.answers)||session.answers.length>7||
    !validAnswers(session.answers,session.answers.length,session.questions)||
    !inRange(session.index,0,7))return null;
  const entries=games.map(game=>{
    if(!Array.isArray(game.questions)||game.questions.length!==7||!Array.isArray(game.answersByPlayer)||
      game.answersByPlayer.length!==c.players)return null;
    const ids=game.questions.map(q=>q.id);
    if(ids.some(x=>typeof x!=="string")||new Set(ids).size!==7)return null;
    if(!game.answersByPlayer.every(row=>row===null||validAnswers(row,7,game.questions)))return null;
    const stakes=game.wagersByPlayer;
    if(!Array.isArray(stakes)||stakes.length!==c.players||
      stakes.some(v=>v!==null&&!PARTY_WAGERS.includes(v)))return null;
    return {questionIds:ids,
      answersByPlayer:game.answersByPlayer.map(row=>row?.map(compactAnswer)||null),
      wagersByPlayer:[...stakes]};
  });
  if(entries.some(x=>x===null))return null;
  if(session.answers.length>session.index+(stage==="feedback"?1:0))return null;
  if(!validDate(createdAt)||!validDate(now)||now<createdAt||now-createdAt>PARTY_MAX_AGE_MS)return null;
  const deadline=session.deadline;
  if(deadline!==null&&(!validDate(deadline)||deadline>now+120000))return null;
  return {version:PARTY_SAVE_VERSION,id:String(id||"").slice(0,110),createdAt,savedAt:now,
    stage,config:c,games:entries,gameIndex,playerIndex,revealIndex,
    index:session.index,answers:session.answers.map(compactAnswer),
    deadline:deadline??null};
}
export function restoreParty(raw,questionBank,now=Date.now()){
  if(!isObj(raw)||raw.version!==PARTY_SAVE_VERSION||!STAGES.has(raw.stage)||
    typeof raw.id!=="string"||raw.id.length<8||raw.id.length>110||
    !validDate(raw.createdAt)||!validDate(raw.savedAt)||
    raw.savedAt<raw.createdAt||raw.savedAt>now+60000||
    now-raw.createdAt>PARTY_MAX_AGE_MS)return null;
  try{
    const config=normalizePartyConfig(raw.config);
    if(JSON.stringify(config)!==JSON.stringify(raw.config)||
      !Array.isArray(raw.games)||raw.games.length!==config.games||
      !inRange(raw.gameIndex,0,config.games-1)||
      !inRange(raw.playerIndex,0,config.players-1)||
      !inRange(raw.revealIndex,-1,6)||!inRange(raw.index,0,7)||
      !validAnswers(raw.answers,raw.answers?.length??-1)||
      raw.answers.length>7||
      (raw.deadline!==null&&(!validDate(raw.deadline)||raw.deadline>now+120000)))return null;
    const byId=questionBank instanceof Map?questionBank:new Map(questionBank.map(q=>[q.id,q]));
    const games=raw.games.map(game=>{
      if(!isObj(game)||!Array.isArray(game.questionIds)||game.questionIds.length!==7||
        new Set(game.questionIds).size!==7||
        !Array.isArray(game.answersByPlayer)||game.answersByPlayer.length!==config.players||
        !Array.isArray(game.wagersByPlayer)||game.wagersByPlayer.length!==config.players||
        game.wagersByPlayer.some(x=>x!==null&&!PARTY_WAGERS.includes(x))||
        game.answersByPlayer.some(row=>row!==null&&!validAnswers(row,7)))return null;
      const questions=game.questionIds.map((id,index)=>{
        const q=byId.get(id);
        if(!q||typeof q!=="object")return null;
        const type=q.choices?"fit":"rare";
        if(type!==(index%2===0?"rare":"fit"))return null;
        return {...q,type,index};
      });
      if(questions.some(x=>!x)||game.answersByPlayer.some(row=>
        row!==null&&!validAnswers(row,7,questions)))return null;
      return {questions,answersByPlayer:game.answersByPlayer,
        wagersByPlayer:game.wagersByPlayer};
    });
    if(games.some(x=>!x))return null;
    // A completed player must have exactly seven answers; the current player
    // may be incomplete. No player can skip a turn. Keep scores sealed on
    // rehydration just as they were in the original local-only party game.
    const current=games[raw.gameIndex];
    if(!validAnswers(raw.answers,raw.answers.length,current.questions))return null;
    if(raw.stage==="duel-reveal"||raw.stage==="duel-game-results"||
      raw.stage==="duel-champion"){
      if(current.answersByPlayer.some(row=>!row))return null;
    }
    if(raw.stage==="duel-wager"&&(!config.finalWager||raw.index!==6||
      current.wagersByPlayer[raw.playerIndex]!==null))return null;
    if(raw.stage==="game"&&raw.index>=7)return null;
    if(raw.stage==="feedback"&&raw.answers.length!==raw.index+1)return null;
    if(raw.stage==="game"&&raw.answers.length!==raw.index)return null;
    if(raw.stage==="duel-ready"&&raw.index!==0)return null;
    return {
      stage:raw.stage,
      session:{mode:"duel",day:new Date(raw.createdAt).toISOString().slice(0,10),
        timerSeconds:config.timerSeconds,questions:current.questions,
        index:raw.index,answers:raw.answers,deadline:raw.deadline,
        duel:{id:raw.id,createdAt:raw.createdAt,config,games,
          gameIndex:raw.gameIndex,playerIndex:raw.playerIndex,
          revealIndex:raw.revealIndex}}
    };
  }catch{return null;}
}
export function summarizePartyArchive(session,completedAt=Date.now()){
  if(session?.mode!=="duel"||!session.duel)return null;
  const d=session.duel;
  const summary=partyStandings(d.config,d.games);
  if(!summary.complete||!validDate(completedAt))return null;
  return {id:d.id,completedAt,config:{players:d.config.players,games:d.config.games,
    names:[...d.config.names],categories:[...d.config.categories],
    timerSeconds:d.config.timerSeconds,finalWager:d.config.finalWager},
    champions:summary.champions.map(row=>row.name),
    standings:summary.table.map(row=>({name:row.name,wins:row.wins,points:row.points})),
    gameScores:d.games.map(game=>game.answersByPlayer.map((_,i)=>{
      const points=(rows=[])=>rows.reduce((sum,a)=>sum+a.points,0);
      const stake=game.wagersByPlayer[i]||0;
      return points(game.answersByPlayer[i])+(game.answersByPlayer[i][6]?.valid?stake:-stake);
    }))};
}
export function addPartyArchive(history=[],item){
  if(!item||typeof item.id!=="string")return Array.isArray(history)?history.slice(0,PARTY_ARCHIVE_LIMIT):[];
  const valid=Array.isArray(history)?history:[];
  return [item,...valid.filter(row=>row?.id!==item.id)].slice(0,PARTY_ARCHIVE_LIMIT);
}

export function anonymousPartyBetaSummary(entry) {
  if(!entry||!entry.config||!Array.isArray(entry.standings)||!Array.isArray(entry.gameScores))return null;
  const n=entry.config.players,g=entry.config.games;
  if(!inRange(n,2,8)||!inRange(g,1,7))return null;
  const all=entry.gameScores.flat().map(Number).filter(Number.isFinite);
  const spread=entry.standings.length?
    Math.max(...entry.standings.map(x=>Number(x.points)||0))-
    Math.min(...entry.standings.map(x=>Number(x.points)||0)):0;
  // Intentionally omit player names, answer text, question IDs, invite codes,
  // browser fingerprints and account identifiers. Copying is always optional.
  return ["OUTLIER v1.8 — Anonymous Game Night Beta",
    "Mode: Pass & Play (unranked)",
    "Players: "+n,
    "Games completed: "+g,
    "Question timer: "+entry.config.timerSeconds+" seconds",
    "Final-round wagers: "+(entry.config.finalWager?"enabled":"disabled"),
    "Co-champions: "+(entry.champions?.length||0),
    "Average points per completed game: "+(all.length?
      Math.round(all.reduce((sum,x)=>sum+x,0)/all.length):0),
    "Final point spread: "+spread,
    "No player names, guesses, identities or codes included."].join("\n");
}
