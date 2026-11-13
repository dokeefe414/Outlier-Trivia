#!/usr/bin/env node
// Preflight a proposed data snapshot before manually adding it to OUTLIER.
// Usage: npm run review:catalog -- path/to/proposed-answers.json
import {readFileSync} from "node:fs";
import {reviewImportedCatalog} from "../src/answer-import.js";

const file=process.argv[2];
if(!file){console.error("Usage: npm run review:catalog -- path/to/proposed-answers.json");process.exit(2);}
try{
  const data=JSON.parse(readFileSync(file,"utf8"));
  const report=reviewImportedCatalog(data);
  console.log(JSON.stringify(report,null,2));
  if(!report.readyForEditorialReview)process.exitCode=1;
}catch(error){console.error("Could not validate proposed catalog:",error.message);process.exitCode=2;}
