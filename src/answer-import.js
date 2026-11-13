// Offline reviewer for large external answer catalogs.
// This tool never publishes an answer or overrides an existing score.
import {normalizeAnswer} from "./answer-intelligence.js";

export function reviewImportedCatalog(input) {
  const issues=[],warnings=[];
  const source=String(input?.sourceUrl||"");
  const license=String(input?.license||"").trim();
  const snapshot=String(input?.snapshotDate||"");
  const questionId=String(input?.questionId||"");
  if(!/^https:\/\//.test(source))issues.push("sourceUrl must use HTTPS");
  if(!license)issues.push("Declare the source license or public-domain status");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(snapshot)||Number.isNaN(Date.parse(snapshot+"T00:00:00Z")))
    issues.push("snapshotDate must be a valid YYYY-MM-DD date");
  if(!/^[a-z0-9-]{3,110}$/.test(questionId))issues.push("Invalid questionId");
  const answers=Array.isArray(input?.answers)?input.answers:[];
  if(!answers.length)issues.push("No answer rows");
  if(answers.length>250000)issues.push("Split source snapshots over 250,000 entries");
  const names=new Map(),aliases=new Map();
  let invalidRows=0;
  for(const row of answers) {
    if(!Array.isArray(row)||typeof row[0]!=="string"||!row[0].trim()||
       row[0].length>80||!Number.isInteger(row[1])||row[1]<1||row[1]>1000||
       (row[2]!==undefined&&!Array.isArray(row[2]))){
      invalidRows++;continue;
    }
    const label=row[0].trim(),key=normalizeAnswer(label);
    if(!key){invalidRows++;continue;}
    if(!names.has(key))names.set(key,new Set());
    names.get(key).add(label);
    for(const raw of row[2]||[]) {
      if(typeof raw!=="string"||raw.length>80){invalidRows++;continue;}
      const alias=normalizeAnswer(raw);
      if(!alias)continue;
      if(!aliases.has(alias))aliases.set(alias,new Set());
      aliases.get(alias).add(key);
    }
  }
  if(invalidRows)issues.push(invalidRows+" malformed or unusable answer/alias rows");
  const conflicts=[...aliases].filter(([key,owners])=>owners.size>1||
    (names.has(key)&&!(owners.size===1&&owners.has(key))));
  if(conflicts.length)issues.push(conflicts.length+" aliases conflict with another approved entity");
  const duplicates=[...names].filter(([,labels])=>labels.size>1);
  if(duplicates.length)issues.push(duplicates.length+" different labels normalize to identical keys");
  const extraRows=answers.length-names.size-invalidRows;
  if(extraRows>0)warnings.push(extraRows+" duplicate canonical rows to inspect");
  warnings.push("Source data and proposed tiers require human validation against the exact prompt.");
  warnings.push("Do not update sealed daily answer IDs, hosted ranked keys, or old score records.");
  return {questionId,sourceUrl:source,license,snapshotDate:snapshot,
    suppliedRows:answers.length,uniqueNames:names.size,
    aliasForms:aliases.size,issues,warnings,
    readyForEditorialReview:issues.length===0,
    acceptedIntoGame:false};
}
