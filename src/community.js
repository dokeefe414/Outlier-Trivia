// Share-safe, deterministic URLs: consent to join is required on the receiver.
export function normalizeLeagueCode(value){
  return /^[a-f0-9]{12}$/i.test(String(value??"").trim())
    ? String(value).trim().toLowerCase() : null;
}
export function readLeagueInvite(search){
  const params=new URLSearchParams(String(search??""));
  return normalizeLeagueCode(params.get("league"));
}
export function leagueInviteLink(siteUrl,code){
  const clean=normalizeLeagueCode(code);
  if(!clean)throw new Error("Invalid league code");
  const url=new URL(siteUrl);
  if(!["https:","http:"].includes(url.protocol))throw new Error("Invalid site URL");
  // Share only the invite token, never a user's email or auth access token.
  url.search="";
  url.hash="";
  url.searchParams.set("online","1");
  url.searchParams.set("league",clean);
  return url.href;
}
export function removeLeagueInvite(siteUrl){
  const url=new URL(siteUrl);
  url.searchParams.delete("league");
  return url.pathname+url.search+url.hash;
}
export function officialShareMessage({day,score,mode="daily",name=""}={}){
  if(mode!=="daily")return "OUTLIER · unranked practice — try your own round!";
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day||""))throw new Error("Invalid daily date");
  if(!Number.isInteger(score)||score<0||score>7000)throw new Error("Invalid daily score");
  const display=String(name||"").trim().replace(/[\r\n\t]/g," ").slice(0,24);
  return "OUTLIER "+day+"\n"+
    (display?display+" · ":"")+score.toLocaleString("en-US")+"/7,000\n"+
    "💎 4 Stand Out · ◎ 3 Fit In\n"+
    "Same seven daily questions. Can you beat me?\n"+
    "No answers or spoilers included.";
}
export function comparisonLabel(you,them){
  const a=Number(you),b=Number(them);
  if(!Number.isFinite(a)||!Number.isFinite(b))return "Scores unavailable";
  if(a===b)return "It's a tie!";
  return a>b?"You're ahead by "+(a-b).toLocaleString("en-US")+" points":
    "You're "+(b-a).toLocaleString("en-US")+" points behind";
}
