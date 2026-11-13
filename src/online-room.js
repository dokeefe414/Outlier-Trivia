// Private online party invitation and timer helpers: never auto-join.
export function normalizeRoomCode(code) {
  const value=String(code??"").trim().toLowerCase();
  return /^[0-9a-f]{12}$/.test(value)?value:null;
}
export function readRoomInvite(search) {
  const params=new URLSearchParams(String(search??""));
  return normalizeRoomCode(params.get("room"));
}
export function roomInviteUrl(pageUrl,code) {
  const clean=normalizeRoomCode(code);
  if(!clean)throw new Error("Invalid invite code");
  const url=new URL(pageUrl);
  if(!["https:","http:"].includes(url.protocol))throw new Error("Invalid site URL");
  url.search="";url.hash="";
  url.searchParams.set("online","1");
  url.searchParams.set("room",clean);
  return url.href;
}
export function roomSecondsRemaining(deadline,serverTime,clientReceivedAt=Date.now(),now=Date.now()) {
  const due=Date.parse(String(deadline||""));
  const server=Date.parse(String(serverTime||""));
  if(!Number.isFinite(due)||!Number.isFinite(server))return 0;
  return Math.max(0,Math.ceil((due-(server+(now-clientReceivedAt)))/1000));
}
export function roomWinnerRows(scores) {
  const valid=(Array.isArray(scores)?scores:[]).filter(x=>Number.isFinite(Number(x.score)));
  if(!valid.length)return [];
  const top=Math.max(...valid.map(x=>Number(x.score)));
  return valid.map(x=>({...x,winner:Number(x.score)===top}));
}
