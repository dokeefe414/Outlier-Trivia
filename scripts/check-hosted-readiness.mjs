// Run without authentication and without sending credentials to the console.
import {readdirSync,existsSync} from "node:fs";
import {SUPABASE_URL,SUPABASE_ANON_KEY} from "../src/online-config.js";
import {assessHostedLaunch} from "../src/deployment-readiness.js";
const base=new URL("../",import.meta.url);
const migrations=readdirSync(new URL("../supabase/migrations/",import.meta.url));
const result=assessHostedLaunch({
  url:SUPABASE_URL,publishableKey:SUPABASE_ANON_KEY,
  migrations,edgeFunctionPresent:existsSync(new URL("../supabase/functions/outlier/index.ts",import.meta.url))
});
console.log(JSON.stringify(result,null,2));
console.log("Owner setup: docs/V19_COMPETITION_QA.md and docs/ONLINE_SETUP.md");
if(process.argv.includes("--strict")&&!result.safeToDescribeAsLive)process.exitCode=1;
