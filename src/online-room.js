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

// Only the room UUID and owning authenticated user are kept locally.
// This is a convenience pointer, NOT authorization or a reusable invite.
export const ROOM_RECOVERY_KEY="outlier-online-room-v1";
export const ROOM_RECOVERY_MAX_AGE=2*60*60*1000;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function roomRecoveryRecord(userId,roomId,now=Date.now()) {
  if(!uuid.test(String(userId))||!uuid.test(String(roomId))||
      !Number.isFinite(now)||now<=0)throw new Error("Invalid private room recovery");
  return {version:1,userId,roomId,savedAt:now};
}
export function readRoomRecovery(raw,userId,now=Date.now()) {
  if(!raw||raw.version!==1||!uuid.test(String(userId))||
     raw.userId!==userId||!uuid.test(String(raw.roomId))||
     !Number.isFinite(raw.savedAt)||raw.savedAt>now+60000||
     now-raw.savedAt>ROOM_RECOVERY_MAX_AGE)return null;
  return raw.roomId;
}
export function retryDelayMs(attempts) {
  const n=Math.min(5,Math.max(0,Math.trunc(Number(attempts)||0)));
  return Math.min(30000,3000*Math.pow(2,n));
}
export function roomConnectivityError(error) {
  // A backend membership denial is authoritative. Temporary network, 5xx,
  // busy or expired-token issues are not proof the user's room vanished.
  const code=Number(error?.status);
  return !(code===403||code===404||code===410);
}
