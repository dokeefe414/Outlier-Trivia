import test from "node:test";
import assert from "node:assert/strict";
import {normalizedGuestNickname,isTemporaryGuest,guestAuthMessage} from "../src/guest-party.js";
test("guest display names normalize human text and preserve Unicode safely",()=>{
  assert.equal(normalizedGuestNickname("  Ace  Runner  "),"Ace Runner");
  assert.equal(normalizedGuestNickname("Maddie_23"),"Maddie_23");
  assert.equal(normalizedGuestNickname("Émile"),"Émile");
});
test("invalid or oversized nicknames never trigger a sign-in",()=>{
  for(const value of ["","a","  ","<script>","🔑","a".repeat(25),"Hello\nWorld"]){
    if(value==="Hello\nWorld"){assert.equal(normalizedGuestNickname(value),"Hello World");continue;}
    assert.throws(()=>normalizedGuestNickname(value),/nickname/);
  }
});
test("guest detection relies on Supabase Auth claims, not editable user metadata",()=>{
  assert.equal(isTemporaryGuest(null),false);
  assert.equal(isTemporaryGuest({id:"1",is_anonymous:true}),true);
  assert.equal(isTemporaryGuest({id:"2",app_metadata:{provider:"anonymous"}}),true);
  assert.equal(isTemporaryGuest({id:"3",user_metadata:{provider:"anonymous"}}),false);
  assert.equal(isTemporaryGuest({id:"4",is_anonymous:false}),false);
  assert.equal(isTemporaryGuest({id:"5",is_anonymous:false,
    app_metadata:{provider:"anonymous"}}),false,
    "A verified linked email must release the guest feature restrictions");
});
test("disabled provider and rate limits produce actionable, non-secret errors",()=>{
  assert.match(guestAuthMessage({message:"Anonymous sign-ins are disabled"}),/Supabase Auth/);
  assert.match(guestAuthMessage({message:"Too many requests"}),/rate-limited/);
  assert.doesNotMatch(guestAuthMessage({message:"Anonymous sign-ins are disabled"}),/service_role/);
});
