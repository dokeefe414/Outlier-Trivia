import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {rareQuestions,fitQuestions} from "../src/data.js";
import {ONLINE_ENABLED,SUPABASE_URL,SUPABASE_ANON_KEY} from "../src/online-config.js";

const seed=readFileSync(new URL("../supabase/migrations/20261112000200_question_bank.sql",import.meta.url),"utf8");
const quote = value => "'" + String(value).replaceAll("'","''") + "'";

test("every curated question and its scoring keys have been seeded server-side",()=>{
  const questions=[...rareQuestions.map(q=>({...q,kind:"rare"})),...fitQuestions.map(q=>({...q,kind:"fit"}))];
  assert.equal(rareQuestions.length,32);
  assert.equal(fitQuestions.length,23);
  for(const q of questions) {
    const row = "(" + [
      quote(q.id),quote(q.kind),quote(q.category),quote(q.prompt),quote(q.detail),
      quote(JSON.stringify(q.answers??[]))+"::jsonb",
      quote(JSON.stringify(q.choices??[]))+"::jsonb"
    ].join(",") + ")";
    assert.ok(seed.includes(row),"Missing/outdated hosted question: "+q.id);
  }
});

test("public browser configuration is safe by default",()=>{
  assert.equal(ONLINE_ENABLED,false);
  assert.equal(SUPABASE_URL,"");
  assert.equal(SUPABASE_ANON_KEY,"");
});
