import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const edge=readFileSync(new URL("../supabase/functions/outlier/index.ts",import.meta.url),"utf8");
const client=readFileSync(new URL("../src/online.js",import.meta.url),"utf8");
const migration=readFileSync(new URL("../supabase/migrations/20261112001800_v17_private_party_rooms.sql",import.meta.url),"utf8");

test("public API permits only explicit nonprivate requests before verified Auth",()=>{
  const auth=edge.indexOf("const user = await currentUser(req);");
  assert.ok(auth>0,"private endpoints must verify /auth/v1/user");
  for(const route of ['party-create','party-join','party-start','party-state',
    'party-answer','party-ready','party-leave','party-rematch',
    'party-history','party-season','party-rivalry','profile','purchase-status']){
    const pos=edge.indexOf('if (action === "'+route+'"',auth);
    assert.ok(pos>auth,"private route must be after authentication: "+route);
  }
  assert.match(edge,/if \(!token \|\| token === serviceKey\) throw new ApiError\(401/);
  assert.match(edge,/\/auth\/v1\/user/);
});
test("browser never uses Supabase service-role secrets and verifies signed-in identity",()=>{
  assert.match(client,/await supabase\.auth\.getUser\(\)/);
  assert.match(client,/onAuthStateChange/);
  assert.match(client,/if \(auth && !token\) throw new Error/);
  assert.doesNotMatch(client,/SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
});
test("private room tables and sensitive entrypoints deny direct browser access",()=>{
  assert.match(migration,/alter table public\.outlier_party_rooms enable row level security/);
  assert.match(migration,/alter table public\.outlier_party_members enable row level security/);
  assert.match(migration,/revoke all on public\.outlier_party_rooms,public\.outlier_party_members/);
  assert.match(migration,/from public,anon,authenticated/);
  assert.match(migration,/to service_role/);
});
