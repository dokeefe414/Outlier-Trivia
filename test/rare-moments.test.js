import test from "node:test";
import assert from "node:assert/strict";
import {describeRareMoment} from "../src/rare-moments.js";
test("approved answer celebrations compare only editorial score entries",()=>{
 const q={type:"rare",answers:[["Common",150],["Solid",500],["Deep",870],["Legend",980]]};
 const info=describeRareMoment(q,{valid:true,points:980,accepted:"Legend"});
 assert.equal(info.intensity,"legendary");
 assert.equal(info.below,3);
 assert.equal(info.total,4);
 assert.equal(info.triggerCelebration,true);
 assert.match(info.sourceNote,/not real player-popularity/);
 assert.match(info.explanation,/3 of 4/);
 assert.equal(describeRareMoment(q,{valid:true,points:150,accepted:"Common"}).intensity,"standard");
 assert.equal(describeRareMoment(q,{valid:false,points:0,accepted:null}),null);
 assert.equal(describeRareMoment({...q,type:"fit"},{valid:true,points:1000,accepted:"A"}),null);
 assert.equal(describeRareMoment({...q,answers:[]},{valid:true,points:980,accepted:"Legend"}),null);
});
