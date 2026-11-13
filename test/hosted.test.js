import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {rareQuestions,fitQuestions} from "../src/data.js";
import {ONLINE_ENABLED,SUPABASE_URL,SUPABASE_ANON_KEY} from "../src/online-config.js";

const legacySeed=readFileSync(new URL("../supabase/migrations/20261112000200_question_bank.sql",import.meta.url),"utf8");
const atlasSeed=readFileSync(new URL("../supabase/migrations/20261112000300_answer_atlas.sql",import.meta.url),"utf8");
const newFitSeed=readFileSync(new URL("../supabase/migrations/20261112000490_fit_expansion.sql",import.meta.url),"utf8");
const packSeeds=Object.fromEntries(["movies","tv","music","sports","animals","food","games","history","people"].map((group,i)=>[group,readFileSync(new URL("../supabase/migrations/202611120004"+String(i).padStart(2,"0")+"_"+group+"_content.sql",import.meta.url),"utf8")]));
const latestPacks=Object.fromEntries(["movies","tv","music","sports","animals","food","games","history","people"].map((group,i)=>[
  group,readFileSync(new URL("../supabase/migrations/2026111200110"+i+"_"+group+"_aliases.sql",import.meta.url),"utf8")
]));
const quote = value => "'" + String(value).replaceAll("'","''") + "'";

test("every curated question and its scoring keys have been seeded server-side",()=>{
  const questions=[...rareQuestions.filter(q=>!q.arcadeOnly).map(q=>({...q,kind:"rare"})),...fitQuestions.map(q=>({...q,kind:"fit"}))];
  assert.equal(rareQuestions.filter(q=>!q.arcadeOnly).length,137);
  assert.equal(fitQuestions.length,53);
  for(const q of questions) {
    const row = "(" + [
      quote(q.id),quote(q.kind),quote(q.category),quote(q.prompt),quote(q.id.startsWith("fit-v05-") ? "Six example crowd responses. These percentages are illustrative." : q.detail),
      quote(JSON.stringify(q.answers??[]))+"::jsonb",
      quote(JSON.stringify(q.choices??[]))+"::jsonb"
    ].join(",") + ")";
    const seed = q.id.startsWith("pack-") ? latestPacks[q.poolGroup] :
      q.id.startsWith("atlas-") ? atlasSeed :
      q.id.startsWith("fit-v05-") ? newFitSeed : legacySeed;
    assert.ok(seed.includes(row),"Missing/outdated hosted question: "+q.id);
  }
});

test("public browser configuration is safe by default",()=>{
  assert.equal(ONLINE_ENABLED,false);
  assert.equal(SUPABASE_URL,"");
  assert.equal(SUPABASE_ANON_KEY,"");
});
