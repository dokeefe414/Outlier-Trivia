import test from "node:test";
import assert from "node:assert/strict";
import {readFriendChallenge,challengeLink,challengeOutcome,categoryInsights} from "../src/social.js";

test("friend links preserve the score and date, without answers or spoiler IDs",()=>{
  const url=challengeLink("https://dokeefe414.github.io/Outlier-Trivia/?online=1#old","2026-11-12",6840);
  assert.equal(url,"https://dokeefe414.github.io/Outlier-Trivia/?beat=6840&day=2026-11-12");
  const challenge=readFriendChallenge(new URL(url).search,"2026-11-12");
  assert.deepEqual(challenge,{score:6840,day:"2026-11-12",current:true});
  assert.equal(challengeOutcome(challenge,"2026-11-12",7000).won,true);
  assert.equal(challengeOutcome(challenge,"2026-11-12",6840).tied,true);
  assert.equal(challengeOutcome(challenge,"2026-11-12",5200).won,false);
  assert.equal(challengeOutcome(challenge,"2026-11-13",7000),null);
});

test("invalid, expired and tampered challenge links cannot force invalid scores",()=>{
  for(const bad of ["?beat=-100&day=2026-11-12","?beat=9000&day=2026-11-12",
    "?beat=100&day=bad","?beat=500&day=2026-02-30","?beat=100.1&day=2026-11-12",
    "?beat=NaN&day=2026-11-12","?beat=1000&day=2026-13-12"]) {
    assert.equal(readFriendChallenge(bad,"2026-11-12"),null,bad);
  }
  assert.equal(readFriendChallenge("?beat=2500&day=2026-11-11","2026-11-12").current,false);
});

test("knowledge DNA averages and accuracy use only completed official runs",()=>{
  const game=answers=>({complete:true,answers});
  const make=(category,points,valid=true)=>({category,points,valid,type:"rare"});
  const a=[make("GEOGRAPHY",900),make("SCIENCE",300),...Array.from({length:5},()=>make("SCIENCE",500))];
  const b=[make("GEOGRAPHY",100,false),...Array.from({length:6},()=>make("GEOGRAPHY",600))];
  const data={
    "2026-11-11":game(a),
    "2026-11-12":game(b),
    "2026-11-13":{complete:false,answers:[make("GEOGRAPHY",1000)]}
  };
  const insights=categoryInsights(data);
  const geo=insights.find(x=>x.name==="GEOGRAPHY");
  assert.equal(geo.attempts,8);
  assert.equal(geo.average,Math.round((900+100+3600)/8));
  assert.equal(geo.accuracy,88);
  assert.equal(categoryInsights({}).length,0);
});
