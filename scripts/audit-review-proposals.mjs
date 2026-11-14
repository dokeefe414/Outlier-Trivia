// npm run audit:proposals -- path/to/review-candidates.json
// Accepts only offline, public/opted-in issue exports, not customer records.
import {readFileSync} from "node:fs";
import {triageAnswerCandidates} from "../src/review-triage.js";
const file=process.argv[2];
if(!file)throw new Error("Usage: npm run audit:proposals -- path/to/candidates.json");
const entries=JSON.parse(readFileSync(file,"utf8"));
const result=triageAnswerCandidates(entries);
console.log(JSON.stringify(result,null,2));
if(result.items.some(x=>["unknown_question","empty"].includes(x.state)))process.exitCode=1;
