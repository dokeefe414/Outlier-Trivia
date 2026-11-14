import test from "node:test";
import assert from "node:assert/strict";
import {normalizeRoomCode,readRoomInvite,roomInviteUrl,roomSecondsRemaining,roomWinnerRows,ROOM_RECOVERY_MAX_AGE,roomRecoveryRecord,readRoomRecovery,retryDelayMs,roomConnectivityError} from "../src/online-room.js";
test("room invitations are single-purpose and never silently join",()=>{
  assert.equal(normalizeRoomCode(" ABCDEF123456 "),"abcdef123456");
  assert.equal(readRoomInvite("?room=abcdef123456&other=stuff"),"abcdef123456");
  assert.equal(readRoomInvite("?room=weird123"),null);
  assert.equal(roomInviteUrl("https://dokeefe414.github.io/Outlier-Trivia/?token=secret#fragment","abcdef123456"),
    "https://dokeefe414.github.io/Outlier-Trivia/?online=1&room=abcdef123456");
  assert.throws(()=>roomInviteUrl("javascript:alert(1)","abcdef123456"));
});
test("private shared timer accounts for the server clock, not client clock skew",()=>{
  const base="2026-11-13T12:00:00.000Z";
  const end="2026-11-13T12:00:45.000Z";
  const then=Date.now();
  assert.equal(roomSecondsRemaining(end,base,then,then),45);
  assert.equal(roomSecondsRemaining(end,base,then,then+18000),27);
  assert.equal(roomSecondsRemaining("invalid",base),0);
});
test("real ties share the crown instead of inventing a winner",()=>{
  const rows=roomWinnerRows([{name:"A",score:500},{name:"B",score:500},{name:"C",score:0}]);
  assert.equal(rows.filter(x=>x.winner).length,2);
  assert.equal(rows[2].winner,false);
});

test("private-room recovery pointer is user-scoped, bounded, and never stores answers",()=>{
  const now=Date.parse("2026-11-14T02:00:00Z");
  const alice="11111111-1111-4111-8111-111111111111";
  const bob="22222222-2222-4222-8222-222222222222";
  const room="33333333-3333-4333-8333-333333333333";
  const record=roomRecoveryRecord(alice,room,now);
  assert.deepEqual(Object.keys(record).sort(),["roomId","savedAt","userId","version"]);
  assert.equal(readRoomRecovery(record,alice,now+1000),room);
  assert.equal(readRoomRecovery(record,bob,now+1000),null);
  assert.equal(readRoomRecovery(record,alice,now+ROOM_RECOVERY_MAX_AGE+1),null);
  assert.equal(readRoomRecovery({...record,roomId:"fake"},alice,now),null);
  assert.throws(()=>roomRecoveryRecord(alice,"not-a-uuid",now));
});
test("transient failures get bounded retry, while membership denials clear recovery",()=>{
  assert.deepEqual([0,1,2,3,4,5,100].map(retryDelayMs),[3000,6000,12000,24000,30000,30000,30000]);
  assert.equal(roomConnectivityError({status:500}),true);
  assert.equal(roomConnectivityError({status:429}),true);
  assert.equal(roomConnectivityError({status:401}),true);
  assert.equal(roomConnectivityError(new Error("offline")),true);
  assert.equal(roomConnectivityError({status:403}),false);
  assert.equal(roomConnectivityError({status:404}),false);
});
