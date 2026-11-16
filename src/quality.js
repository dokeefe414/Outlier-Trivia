import {rareQuestions,fitQuestions} from "./data.js";
import {contentQualitySnapshot} from "./content-quality.js";
const $=selector=>document.querySelector(selector);
const add=(tag,text,parent,cls)=>{
  const element=document.createElement(tag);
  element.textContent=text;
  if(cls)element.className=cls;
  parent.append(element);return element;
};
let report=null;
function show(){
  const summary=$("#qa-summary"),rows=$("#qa-categories"),filter=$("#qa-filter");
  const values=[
    ["STAND OUT PROMPTS",report.rareQuestions],
    ["APPROVED ANSWER SLOTS",report.answerSlots],
    ["ALTERNATE NAME SLOTS",report.aliases],
    ["STRUCTURAL ALERTS",report.warningCount]
  ];
  for(const [label,value] of values){
    const card=add("div","",summary);
    add("span",label,card);add("strong",Number(value).toLocaleString("en-US"),card);
  }
  for(const group of report.groupStats){
    const tr=add("tr","",rows);
    for(const value of [group.name.toUpperCase(),group.rare,group.answers,group.aliases])
      add("td",typeof value==="number"?value.toLocaleString("en-US"):value,tr);
    const opt=add("option",group.name.toUpperCase(),filter);opt.value=group.name;
  }
  renderPrompts();
  const alerts=$("#qa-warnings");
  if(!report.warningCount)add("p","PASS — No published structural alias collisions, out-of-range rarity points or malformed editorial predictions detected.",alerts,"qa-ok");
  else for(const warning of report.warnings){
    add("div",warning.id+" · "+warning.kind+" · "+warning.count,alerts,"qa-alert");
  }
  add("p",report.editorialNotice,alerts,"qa-card");
  $("#qa-status").textContent="Public catalog audit complete. No private data or user events were inspected.";
}
function renderPrompts(){
  const table=$("#qa-prompts"),filter=$("#qa-filter").value;
  table.replaceChildren();
  const rows=report.largest.filter(x=>filter==="all"||x.category===filter);
  if(!rows.length){const tr=add("tr","",table);add("td","No top-16 prompts in this group.",tr);return;}
  for(const q of rows){
    const tr=add("tr","",table);
    add("td",q.id,tr);add("td",Number(q.answerSlots).toLocaleString("en-US"),tr);
  }
}
$("#qa-filter").addEventListener("change",renderPrompts);
$("#qa-copy").addEventListener("click",async()=>{
  if(!report)return;
  const safe={...report,createdAt:new Date().toISOString()};
  try{await navigator.clipboard.writeText(JSON.stringify(safe,null,2));
    $("#qa-status").textContent="Aggregated public QA report copied.";
  }catch{$("#qa-status").textContent="Copy unavailable in this browser.";}
});
setTimeout(()=>{
  try{report=contentQualitySnapshot(rareQuestions,fitQuestions);show();}
  catch(error){$("#qa-status").textContent="Could not audit the published content. See console for details.";console.error(error);}
},0);
