// OUTLIER Party Duel — pure, unranked local match rules.
// No network scores, account entitlements, official streaks, or saved dailies.
import {shuffled,practiceCategoryOptions} from "./game.js";
import {DAILY_PATTERN,rareQuestions,fitQuestions} from "./data.js";

export const PARTY_LIMITS=Object.freeze({minPlayers:2,maxPlayers:8,minGames:1,maxGames:7,roundsPerGame:7});
export const PARTY_TIMERS=Object.freeze([20,30,45,60,90]);
export const PARTY_WAGERS=Object.freeze([0,100,250,500]);
export const PARTY_TOPICS=Object.freeze(practiceCategoryOptions.filter(t=>t.value!=="surprise"));

const groups=new Set(PARTY_TOPICS.map(t=>t.value));
const clamp=(n,min,max)=>Number.isFinite(+n)?Math.min(max,Math.max(min,Math.trunc(+n))):min;
const validName=(name,index)=>{
  const text=String(name??"").replace(/\s+/g," ").trim().slice(0,18);
  return text || "PLAYER "+(index+1);
};

export function normalizePartyConfig(config={}) {
  const players=clamp(config.players??2,PARTY_LIMITS.minPlayers,PARTY_LIMITS.maxPlayers);
  const games=clamp(config.games??1,PARTY_LIMITS.minGames,PARTY_LIMITS.maxGames);
  const timerSeconds=PARTY_TIMERS.includes(Number(config.timerSeconds))?Number(config.timerSeconds):45;
  const finalWager=config.finalWager===true;
  const selected=Array.isArray(config.categories)?config.categories:[];
  const categories=[...new Set(selected.filter(x=>groups.has(x)))];
  const supplied=Array.isArray(config.names)?config.names:[];
  const names=Array.from({length:players},(_,i)=>validName(supplied[i],i));
  if(new Set(names.map(n=>n.toLocaleLowerCase("en-US"))).size!==names.length){
    throw new Error("Give every player a different name.");
  }
  return {players,games,categories,names,timerSeconds,finalWager};
}

function deck(source,random) {
  let queue=shuffled(source,random),pointer=0;
  return (used)=>{
    // Do not repeat a question within one game, even after a reshuffle.
    for(let tries=0;tries<source.length*3+1;tries++){
      if(pointer>=queue.length){queue=shuffled(source,random);pointer=0;}
      const item=queue[pointer++];
      if(item&&!used.has(item.id))return item;
    }
    throw new Error("Not enough distinct questions in the selected categories.");
  };
}

export function buildPartyGames(input={},random=Math.random) {
  const config=normalizePartyConfig(input);
  const categoryList=config.categories.length?config.categories:PARTY_TOPICS.map(x=>x.value);
  const allRare=rareQuestions.filter(q=>q.bigPool&&categoryList.includes(q.poolGroup));
  if(new Set(allRare.map(q=>q.id)).size<4) {
    throw new Error("Choose more categories. This selection needs four different Stand Out questions per game.");
  }
  if(fitQuestions.length<3)throw new Error("Crowd question bank needs at least three prompts.");
  const rareDeck=deck(allRare,random);
  const groupDecks=new Map(categoryList.map(group=>[group,deck(allRare.filter(q=>q.poolGroup===group),random)]));
  const fitDeck=deck(fitQuestions,random);
  const games=[];
  // Rotate through the selected categories across games, without preferring
  // groups merely because their source catalog contains more questions.
  let categoryCursor=0;
  for(let gameIndex=0;gameIndex<config.games;gameIndex++){
    const usedRare=new Set(),usedFit=new Set(),selectedRare=[];
    for(let slot=0;slot<4;slot++){
      let item=null;
      for(let offset=0;offset<categoryList.length;offset++){
        const group=categoryList[(categoryCursor+offset)%categoryList.length];
        try {item=groupDecks.get(group)(usedRare);}catch{continue;}
        if(item){categoryCursor=(categoryCursor+offset+1)%categoryList.length;break;}
      }
      if(!item)item=rareDeck(usedRare);
      usedRare.add(item.id);
      selectedRare.push(item);
    }
    const rare=shuffled(selectedRare,random),fit=[];
    for(let i=0;i<3;i++){const item=fitDeck(usedFit);usedFit.add(item.id);fit.push(item);}
    const questions=DAILY_PATTERN.map((type,index)=>({
      ...(type==="rare"?rare.shift():fit.shift()),type,index
    }));
    if(questions.length!==7||new Set(questions.map(q=>q.id)).size!==7)
      throw new Error("Invalid party game slate.");
    games.push({questions,answersByPlayer:Array.from({length:config.players},()=>null),
      wagersByPlayer:Array.from({length:config.players},()=>config.finalWager?null:0)});
  }
  return games;
}

const points=rows=>(Array.isArray(rows)?rows:[])
  .reduce((sum,row)=>sum+(Number.isFinite(+row?.points)?Math.max(0,Math.min(1000,+row.points)):0),0);
export function partyWagerAdjustment(game,playerIndex) {
  const stake=Number(game?.wagersByPlayer?.[playerIndex]??0);
  if(!PARTY_WAGERS.includes(stake))return 0;
  const final=game?.answersByPlayer?.[playerIndex]?.[6];
  return final?.valid?stake:-stake;
}
export function partyGameScores(game,playerCount) {
  if(!game||!Array.isArray(game.answersByPlayer))return null;
  const rows=game.answersByPlayer.slice(0,playerCount);
  if(rows.length!==playerCount||rows.some(row=>!Array.isArray(row)||row.length!==7))return null;
  const scores=rows.map((row,i)=>points(row)+partyWagerAdjustment(game,i)),best=Math.max(...scores);
  return {scores,winners:scores.map((score,i)=>score===best?i:-1).filter(i=>i>=0)};
}
export function partyStandings(config,games) {
  const c=normalizePartyConfig(config);
  const table=c.names.map((name,index)=>({index,name,wins:0,points:0,played:0}));
  for(const game of games){
    const scores=partyGameScores(game,c.players);
    if(!scores)continue;
    for(let i=0;i<c.players;i++){
      table[i].points+=scores.scores[i];
      table[i].played++;
      if(scores.winners.includes(i))table[i].wins++;
    }
  }
  table.sort((a,b)=>b.wins-a.wins||b.points-a.points||a.index-b.index);
  const complete=table.every(row=>row.played===c.games);
  const champions=complete?table.filter(row=>row.wins===table[0].wins&&row.points===table[0].points):[];
  return {table,complete,champions,played:table[0]?.played||0};
}

export function partyRevealRound(game,index,names) {
  if(!Array.isArray(names)||index<0||index>=7)return null;
  const result=partyGameScores(game,names.length);
  if(!result)return null;
  const question=game.questions[index];
  const picks=names.map((name,playerIndex)=>{
    const answer=game.answersByPlayer[playerIndex][index];
    const adjustment=index===6?partyWagerAdjustment(game,playerIndex):0;
    return {name,playerIndex,answer:answer?.accepted||"No accepted answer",
      points:(Number(answer?.points)||0)+adjustment,
      basePoints:Number(answer?.points)||0,
      wager:index===6?Number(game?.wagersByPlayer?.[playerIndex]??0):0,
      wagerAdjustment:adjustment,valid:!!answer?.valid};
  });
  const high=Math.max(...picks.map(p=>p.points));
  return {question,index,picks,high,
    bestPickers:high>0?picks.filter(p=>p.points===high).map(p=>p.playerIndex):[]};
}

export function partyRevealBeat(game,index,names) {
  const frame=partyRevealRound(game,index,names);
  if(!frame)return null;
  if(index===6) {
    const anyWager=frame.picks.some(p=>p.wager>0);
    return anyWager?"FINAL BETS HAVE LANDED. THE SCOREBOARD DECIDES THE CROWN.":
      "SEVEN ANSWERS. ONE CHAMPION REVEAL REMAINS.";
  }
  if(frame.high<=0)return "THE ROOM GOES QUIET. NOBODY SCORES THIS ROUND.";
  if(frame.bestPickers.length>1)return "A DEAD HEAT ON THIS QUESTION.";
  const leader=names[frame.bestPickers[0]];
  return String(leader).toUpperCase()+" TAKES THE TOP PICK THIS ROUND.";
}
