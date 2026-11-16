// Offline, explicit beta report. No telemetry or network requests.
import {readFileSync} from "node:fs";
import {evaluateBetaReport} from "../src/beta-release.js";
const path=process.argv[2];
if(!path)throw new Error("Usage: npm run beta:report -- private/beta-observations.json");
const data=JSON.parse(readFileSync(path,"utf8"));
const result=evaluateBetaReport(data);
console.log(JSON.stringify(result,null,2));
if(!result.valid||!result.ready)process.exitCode=1;
