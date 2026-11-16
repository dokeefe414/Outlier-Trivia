#!/usr/bin/env node
// A reviewable offline export. Writes under gitignored ./private/ only.
// No deployment, secrets, hosted connections or player data are used.
import {buildExhibitionBank} from "../src/exhibition-bank.js";
import {writeFileSync,mkdirSync} from "node:fs";
import {resolve,dirname,sep} from "node:path";
const questions=buildExhibitionBank();
const totals={rare:questions.filter(x=>x.kind==="rare").length,
  fit:questions.filter(x=>x.kind==="fit").length,
  canonical:questions.reduce((sum,q)=>sum+(q.answers?.length||0),0)};
if(totals.rare<58||totals.fit<42||questions.length<100)throw new Error("Not enough source-checked game-night prompts");
console.log("OUTLIER exhibition audit:",JSON.stringify(totals));
console.log("Rare prompts use complete source-bounded archived, unranked atlas sets; see attribution in each question.");
console.log("All Fit In weights are author-defined examples, NOT player survey results.");
if(process.argv.includes("--audit"))process.exit(0);
const path=resolve("private/generated-exhibition-import.sql");
const root=resolve("private")+sep;
if(!path.startsWith(root))throw new Error("Refusing to write SQL outside private/");
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const fields=questions.map(q=>[
 quote(q.id),quote(q.kind),quote(q.category),quote(q.prompt),quote(q.detail),
 quote(JSON.stringify(q.answers||[]))+"::jsonb",
 quote(JSON.stringify(q.choices||[]))+"::jsonb"
].join(",")).map(row=>"("+row+")");
const sql="-- OWNER-REVIEWED EXHIBITION QUESTIONS. NOT RANKED DAILY ANSWER KEYS.\n"+
 "-- Source scopes: docs/V16_UNIVERSAL_ANSWER_ATLAS.md and docs/OPEN_ANSWER_ATLAS.md; Fit In values are fictional editorial examples.\n"+
 "begin;\ninsert into private.outlier_party_question_bank"+
 "(id,kind,category,prompt,detail,answers,choices) values\n"+
 fields.join(",\n")+"\non conflict(id) do nothing;\ncommit;\n";
mkdirSync(dirname(path),{recursive:true});
try{writeFileSync(path,sql,{flag:"wx",mode:0o600});}
catch(error){throw new Error("Private export already exists. Move or remove it before regeneration.");}
console.log("Private SQL export ready at "+path+". Review and import to your owner-controlled Supabase project.");
