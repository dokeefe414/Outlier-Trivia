// Private-room season presentation: titles are ONLY cosmetic and derive from
// authenticated server-scored wins, never local storage or client claims.
export const PRIVATE_TITLES=Object.freeze([
  {minimum:0,name:"CHALLENGER",icon:"◇"},
  {minimum:1,name:"FIRST CROWN",icon:"✦"},
  {minimum:3,name:"RISING CONTENDER",icon:"⚡"},
  {minimum:10,name:"SEASON VETERAN",icon:"◆"},
  {minimum:25,name:"INNER CIRCLE LEGEND",icon:"♛"}
]);
export function privateTitle(wins=0){
  const count=Number.isInteger(Number(wins))?Math.max(0,Number(wins)):0;
  return [...PRIVATE_TITLES].reverse().find(x=>count>=x.minimum)||PRIVATE_TITLES[0];
}
export function privateSeasonLeaders(rows=[]){
  const cleaned=(Array.isArray(rows)?rows:[]).filter(x=>
    typeof x?.id==="string"&&typeof x?.name==="string"&&
    [x.games,x.wins,x.ties,x.losses,x.points].every(v=>
      Number.isInteger(Number(v))&&Number(v)>=0)&&
    Number(x.games)===Number(x.wins)+Number(x.ties)+Number(x.losses));
  const standings=cleaned.map(x=>({...x,
    games:Number(x.games),wins:Number(x.wins),ties:Number(x.ties),
    losses:Number(x.losses),points:Number(x.points),
    title:privateTitle(x.wins)}));
  standings.sort((a,b)=>b.wins-a.wins||b.points-a.points||a.name.localeCompare(b.name));
  const maxWins=standings.length?standings[0].wins:0;
  return standings.map(x=>({...x,seasonLeader:maxWins>0&&x.wins===maxWins}));
}
export function cleanRivalryTimeline(rows=[]){
  if(!Array.isArray(rows))return [];
  return rows.slice(0,10).filter(x=>
    ["win","loss","tie"].includes(x?.outcome)&&
    Number.isInteger(Number(x.you))&&Number(x.you)>=0&&Number(x.you)<=7000&&
    Number.isInteger(Number(x.them))&&Number(x.them)>=0&&Number(x.them)<=7000&&
    Number.isFinite(Date.parse(x.startedAt)));
}
