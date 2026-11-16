// OUTLIER Game Night 2.0: presentation-only insights from SERVER-CLOSED rooms.
// Never derive provisional scores or expose hidden guesses during an active match.
export const ROOM_THEMES=Object.freeze([
  "MOVIES","MUSIC","SCIENCE","FOOD","SPORTS","ANIMALS","GEOGRAPHY","GAMES"
]);
export const ROOM_TIMERS=Object.freeze([20,30,45,60,90]);
export const ROOM_SERIES=Object.freeze([1,3,5]);

const safeScore=value=>Number.isFinite(Number(value))
  ? Math.max(0,Math.min(1000,Number(value))):0;
export function privateGameHighlights(room) {
  if(room?.phase!=="finished"||!Array.isArray(room.players)||
      !Array.isArray(room.answers)||!Array.isArray(room.scores))return null;
  const players=room.players.slice(0,4).filter(x=>x && typeof x.id==="string");
  const cumulative=new Map(players.map(p=>[p.id,0]));
  const rounds=[];
  let highest=null;
  let priorLeader=null;
  let leadChanges=0;
  for(let i=0;i<7;i++){
    const scores=players.map(p=>{
      // The database enforces one response per user/round; ignore malformed
      // duplicates defensively if a response is ever corrupted in transit.
      const answer=room.answers.find(a=>a?.index===i&&a.player===p.id);
      const points=answer?safeScore(answer.points):0;
      cumulative.set(p.id,(cumulative.get(p.id)||0)+points);
      if(points>0 && answer?.accepted &&
         (!highest||points>highest.points)){
        highest={player:p.name||"Player",answer:String(answer.accepted),points,round:i+1};
      }
      return {id:p.id,name:p.name||"Player",points,total:cumulative.get(p.id)};
    });
    const top=Math.max(0,...scores.map(p=>p.total));
    const leaders=scores.filter(p=>p.total===top);
    const leader=leaders.length===1?leaders[0].id:null;
    if(i>0&&priorLeader&&leader&&leader!==priorLeader)leadChanges++;
    if(leader)priorLeader=leader;
    rounds.push({number:i+1,scores,leader,top});
  }
  const ordered=room.scores
    .filter(x=>cumulative.has(x?.id)&&Number.isFinite(Number(x.score)))
    .map(x=>({...x,score:Number(x.score)}))
    .sort((a,b)=>b.score-a.score);
  const winning=ordered[0]?.score??0;
  const winners=ordered.filter(p=>p.score===winning);
  const margin=ordered.length>=2?winning-ordered[1].score:null;
  // A comeback means a final winner trailed the highest score after round 4.
  const atFour=rounds[3]?.scores||[];
  const fourthHigh=Math.max(0,...atFour.map(x=>x.total));
  const comeback=winners.some(w=>(atFour.find(x=>x.id===w.id)?.total??0)<fourthHigh);
  return {rounds,highest,leadChanges,comeback,
    winnerNames:winners.map(x=>x.name||"Player"),
    margin,closeFinish:margin!==null&&margin<=250,
    finalScores:ordered};
}

// Only public score totals are copied. Do not include player names, IDs,
// raw answers, invite codes, unpublished questions, or account information.
export function privateScoreShareText(room) {
  const data=privateGameHighlights(room);
  if(!data)return null;
  return [
    "OUTLIER · PRIVATE GAME NIGHT",
    "7 rounds · "+(room.roundSeconds||45)+" seconds per round",
    data.finalScores.map((p,i)=>(i+1)+". "+p.score.toLocaleString("en-US")+" pts").join(" | "),
    "Top rare pick: "+(data.highest?.points||0).toLocaleString("en-US")+" pts",
    "Play the free game: https://dokeefe414.github.io/Outlier-Trivia/"
  ].join("\n");
}

export function earnedPrivateBadges(input){
  const d=input&&typeof input==="object"?input:{};
  const games=Math.max(0,Number(d.games)||0),wins=Math.max(0,Number(d.wins)||0);
  const rare=Math.max(0,Number(d.rareHits)||0),best=Math.max(0,Number(d.bestScore)||0);
  return [
    {id:"first-match",name:"FIRST CONTACT",unlocked:games>=1,
      description:"Finish your first verified private game night."},
    {id:"hat-trick",name:"TRIPLE THREAT",unlocked:wins>=3,
      description:"Win three verified private matches."},
    {id:"deep-cut",name:"DEEP CUT HUNTER",unlocked:rare>=5,
      description:"Score five answers worth 850+ points."},
    {id:"record-run",name:"HIGH FLYER",unlocked:best>=4500,
      description:"Earn 4,500 points in a single private match."},
    {id:"regular",name:"THE REGULAR",unlocked:games>=10,
      description:"Complete ten private match nights."},
    {id:"legend",name:"INNER CIRCLE LEGEND",unlocked:wins>=15,
      description:"Win fifteen verified private matches."}
  ];
}
