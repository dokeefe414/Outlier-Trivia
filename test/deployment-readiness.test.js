import test from "node:test";
import assert from "node:assert/strict";
import {assessHostedLaunch,REQUIRED_ONLINE_MIGRATIONS} from "../src/deployment-readiness.js";
const configured={
  url:"https://example-123.supabase.co",
  publishableKey:"sb_publishable_long_identifier_example_1234",
  migrations:[...REQUIRED_ONLINE_MIGRATIONS],
  edgeFunctionPresent:true
};
test("the static guest site is never presented as active online multiplayer",()=>{
  const result=assessHostedLaunch({migrations:configured.migrations,edgeFunctionPresent:true});
  assert.equal(result.safeToDescribeAsLive,false);
  assert.ok(result.blockers.some(x=>x.includes("Supabase URL")));
});
test("configured public identifiers and all migrations are necessary but insufficient",()=>{
  const result=assessHostedLaunch(configured);
  assert.equal(result.staticSourceReady,true);
  assert.equal(result.safeToDescribeAsLive,false);
  assert.equal(result.evidence.crossDeviceTested,false);
  assert.equal(JSON.stringify(result).includes(configured.publishableKey),false);
});
test("missing migration or non-Supabase endpoint is not launch-ready",()=>{
  const r=assessHostedLaunch({...configured,url:"https://example.invalid",
    migrations:configured.migrations.slice(0,-1)});
  assert.equal(r.staticSourceReady,false);
  assert.equal(r.code.migrationsPresent,false);
  assert.ok(r.blockers.some(x=>x.includes("20261112002100")));
});
test("only explicitly recorded deployment and human-device checks may clear blockers",()=>{
  const r=assessHostedLaunch({...configured,separateExhibitionCatalogReviewed:true,
    authenticationTested:true,edgeEndpointTested:true,crossDeviceTested:true});
  assert.equal(r.safeToDescribeAsLive,true);
  assert.deepEqual(r.blockers,[]);
});
