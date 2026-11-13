import test from "node:test";
import assert from "node:assert/strict";
import {normalizeRoomCode,readRoomInvite,roomInviteUrl,roomSecondsRemaining,roomWinnerRows} from "../src/online-room.js";
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
