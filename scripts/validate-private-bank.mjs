#!/usr/bin/env node
// Owner-local ranked-content linter and SQL exporter. Sensitive input/output
// must stay in the gitignored ./private/ directory and never enter GitHub.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve,dirname,relative,sep} from "node:path";
import {randomBytes} from "node:crypto";
import {auditQuestionAliases,normalizeAnswer} from "../src/answer-intelligence.js";
const inputArg=process.argv[2];
if(inputArg==="--new-id"){
  console.log("rq_"+randomBytes(16).toString("hex"));process.exit(0);
}
if(!inputArg){
  console.error("Usage: node scripts/validate-private-bank.mjs private/questions.json [--validate-only]");
  console.error("Or: node scripts/validate-private-bank.mjs --new-id");
  process.exit(2);
}
const input=resolve(inputArg),root=resolve("private");
if(!input.startsWith(root+sep)){
  console.error("Place your private JSON in ./private/ (gitignored).");
  process.exit(2);
}
const required={geo:3,science:2,wild:2,movies:2,tv:2,music:3,sports:3,
  animals:3,food:2,games:2,history:2,people:2,fit:21};
const counts=new Map(Object.keys(required).map(key=>[key,0]));
const errors=[];
let questions=[];
try{questions=JSON.parse(readFileSync(input,"utf8"))}
catch{errors.push("Private input must be valid JSON.");}
if(!Array.isArray(questions)){errors.push("Expected an array.");questions=[];}
const ids=new Set();
for(const [i,q] of questions.entries()){
  const label="Question "+(i+1);
  if(!q||typeof q!=="object"){errors.push(label+": invalid object");continue;}
  if(typeof q.id!=="string"||!/^rq_[a-z0-9]{16,64}$/.test(q.id)){
    errors.push(label+": IDs must be random rq_ IDs; use --new-id.");
  }else if(ids.has(q.id)){errors.push(label+": duplicate ID");}
  ids.add(q.id);
  if(!["rare","fit"].includes(q.kind)||!Object.hasOwn(required,q.poolGroup)){
    errors.push(label+": invalid kind or poolGroup");continue;
  }
  if((q.kind==="fit") !== (q.poolGroup==="fit"))
    errors.push(label+": kind and poolGroup disagree.");
  counts.set(q.poolGroup,counts.get(q.poolGroup)+1);
  if(typeof q.prompt!=="string"||q.prompt.length<10||q.prompt.length>240)
    errors.push(label+": question must be 10–240 characters.");
  if(typeof q.category!=="string"||q.category.length<2||q.category.length>40)
    errors.push(label+": category must be 2–40 characters.");
  if(typeof q.detail!=="string"||q.detail.length>300)
    errors.push(label+": detail must be at most 300 characters.");
  if(q.kind==="rare"){
    if(!Array.isArray(q.answers)||q.answers.length<20){
      errors.push(label+": rare prompt needs at least 20 approved entities.");continue;
    }
    const rowValid=q.answers.every(x=>Array.isArray(x)&&x.length>=2&&x.length<=3
      &&typeof x[0]==="string"&&x[0].length>0&&x[0].length<=100
      &&Number.isInteger(x[1])&&x[1]>=1&&x[1]<=1000
      &&(x[2]===undefined || (Array.isArray(x[2])&&x[2].every(a=>
        typeof a==="string"&&a.length>0&&a.length<=100))));
    if(!rowValid){errors.push(label+": malformed accepted answer or alias.");continue;}
    const result=auditQuestionAliases(q);
    if(result.collisions.length)errors.push(label+": duplicate or ambiguous aliases.");
  }else{
    if(!Array.isArray(q.choices)||q.choices.length!==6
      ||q.choices.some(x=>!Array.isArray(x)||x.length!==2
        ||typeof x[0]!=="string"||!x[0]||x[0].length>100
        ||!Number.isInteger(x[1])||x[1]<0||x[1]>100)
      ||q.choices.reduce((n,x)=>n+(Number(x?.[1])||0),0)!==100)
      errors.push(label+": Fit In needs six valid shares totaling 100.");
    else if(new Set(q.choices.map(x=>normalizeAnswer(x[0]))).size!==6)
      errors.push(label+": duplicate Fit In options.");
  }
}
for(const [group,minimum] of Object.entries(required))
  if(counts.get(group)<minimum)
    errors.push("Coverage: "+group+" needs "+minimum+" prompts, found "+counts.get(group)+".");
if(errors.length){
  errors.slice(0,35).forEach(e=>console.error("✗ "+e));
  console.error("Private bank invalid ("+errors.length+" problems). No SQL created.");
  process.exit(1);
}
const rares=questions.filter(q=>q.kind==="rare").length;
console.log("Validated "+questions.length+" private prompts ("+rares+" rare).");
if(process.argv.includes("--validate-only"))process.exit(0);
const output=resolve("private/generated-ranked-import.sql");
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const rows=questions.map(q=>"("+[
  quote(q.id),quote(q.kind),quote(q.poolGroup),
  quote(q.category),quote(q.prompt),quote(q.detail),
  quote(JSON.stringify(q.answers||[]))+"::jsonb",
  quote(JSON.stringify(q.choices||[]))+"::jsonb"
].join(",")+")");
const sql="-- PRIVATE ANSWERS. NEVER COMMIT.\n"+
  "begin;\ninsert into private.ranked_question_bank"+
  "(id,kind,pool_group,category,prompt,detail,answers,choices)\nvalues\n"+
  rows.join(",\n")+"\non conflict(id) do nothing;\ncommit;\n";
mkdirSync(dirname(output),{recursive:true});
try{writeFileSync(output,sql,{flag:"wx",mode:0o600})}
catch{console.error("Private output already exists; rename it first.");process.exit(1);}
console.log("Created "+relative(process.cwd(),output)+" (gitignored).");
console.log("Import this only into your owner-controlled private Supabase project.");
