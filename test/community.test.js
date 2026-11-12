import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLeagueCode,readLeagueInvite,leagueInviteLink,
  removeLeagueInvite,officialShareMessage,comparisonLabel
} from "../src/community.js";

test("league invites validate code, preserve site path, omit private query data",()=>{
  const site="https://dokeefe414.github.io/Outlier-Trivia/?beat=5600&day=2026-11-12&email=secret";
  const invite=leagueInviteLink(site,"ABCDEF012345");
  const uri=new URL(invite);
  assert.equal(uri.pathname,"/Outlier-Trivia/");
  assert.equal(uri.searchParams.get("online"),"1");
  assert.equal(uri.searchParams.get("league"),"abcdef012345");
  assert.equal(uri.searchParams.has("email"),false);
  assert.equal(uri.searchParams.has("beat"),false);
  assert.equal(readLeagueInvite(uri.search),"abcdef012345");
  assert.equal(normalizeLeagueCode("ABCDEF012345"),"abcdef012345");
  assert.equal(readLeagueInvite("?league=abcdef012345&online=1"),"abcdef012345");
  assert.equal(readLeagueInvite("?league=bad-code&online=1"),null);
  assert.equal(readLeagueInvite("?league=abcdef012345%3Cscript%3E"),null);
  assert.throws(()=>leagueInviteLink(site,"bad"),/Invalid league code/);
  assert.equal(removeLeagueInvite(invite),"/Outlier-Trivia/?online=1");
});
test("sharing never exposes an official accepted answer",()=>{
  const share=officialShareMessage({day:"2026-11-12",score:5730,name:"Runner Friend"});
  assert.match(share,/5,730\/7,000/);
  assert.match(share,/No answers or spoilers included/);
  assert.ok(!share.includes("Stephen Curry"));
  assert.equal(officialShareMessage({day:"2026-11-12",score:3456,mode:"practice"}),
    "OUTLIER · unranked practice — try your own round!");
  assert.throws(()=>officialShareMessage({day:"2026-11-12",score:7001}),/Invalid daily score/);
  assert.throws(()=>officialShareMessage({day:"2026-11-12",score:-1}),/Invalid daily score/);
  assert.equal(comparisonLabel(5000,4500),"You're ahead by 500 points");
  assert.equal(comparisonLabel(5000,5500),"You're 500 points behind");
  assert.equal(comparisonLabel(5000,5000),"It's a tie!");
  assert.equal(comparisonLabel("bad",5000),"Scores unavailable");
});
