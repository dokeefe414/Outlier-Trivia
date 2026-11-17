import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const edge=readFileSync(new URL("../supabase/functions/outlier/index.ts",import.meta.url),"utf8");
const frontend=readFileSync(new URL("../src/online.js",import.meta.url),"utf8");

test("server enforces a deliberately narrow guest action allowlist",()=>{
  const list=edge.match(/const guestActions=new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(list,"Anonymous routing must use an explicit allowlist");
  const actions=[...list[1].matchAll(/"([^"]+)"/g)].map(m=>m[1]).sort();
  assert.deepEqual(actions,[
    "profile","party-create","party-join","party-config","party-target",
    "party-theme","party-start","party-state","party-ready","party-leave",
    "party-rematch","party-answer"
  ].sort());
  for(const forbidden of [
    "start","daily","answer","advance","league-create","league-join","checkout",
    "restore","crowd-consent","review","party-season","party-history","party-rivalry",
    "party-mastery","admin"
  ])assert.ok(!actions.includes(forbidden),forbidden);
  assert.match(edge,/const user = await currentUser\(req\)/);
  assert.match(edge,/if\(user\.isGuest && !guestActions\.has\(action\)\)/);
  assert.match(edge,/account_required_for_this_feature/);
  assert.match(edge,/user\.is_anonymous===true/);
  assert.doesNotMatch(edge,/user\.user_metadata.*isGuest/);
});
test("guest users are only created after an explicit nickname form submission",()=>{
  assert.match(frontend,/async function ensureGuestRoomIdentity\(nickname\)/);
  assert.match(frontend,/supabase\.auth\.signInAnonymously\(\)/);
  const mount=frontend.slice(frontend.indexOf("export async function mountOnline"));
  assert.ok(mount.length>0);
  assert.doesNotMatch(mount,/signInAnonymously/,"Loading a link cannot mint an anonymous identity");
  assert.match(frontend,/if\(form\.dataset\.form==="guest-party"\)/);
  assert.match(frontend,/if\(intent==="join"&&!\/\^\[a-f0-9\]\{12\}\$\/\.test\(code\)\)/);
  assert.match(frontend,/guestEntering/);
});
