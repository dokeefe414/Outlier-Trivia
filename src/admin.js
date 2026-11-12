// Admin-only browser tool. No service_role key, token persistence or HTML from reports.
import {SUPABASE_URL} from "./online-config.js";
const $=selector=>document.querySelector(selector);
const state={token:"",api:"",busy:false};
const base=$('#configuration'),workspace=$('#workspace'),reviews=$('#reviews'),metrics=$('#metrics');
const statusNode=$('#admin-status');
function element(tag,cls,text=""){
  const e=document.createElement(tag);
  if(cls)e.className=cls;
  if(text!==undefined)e.textContent=text;
  return e;
}
function say(value){statusNode.textContent=value;}
function setBusy(value){state.busy=value;for(const btn of document.querySelectorAll('button'))btn.disabled=value;}
async function request(action,{method="GET",params={},body}={}){
  if(!state.token||!state.api)throw Error("Connect with your owner token first.");
  const url=new URL(state.api);
  url.searchParams.set("action",action);
  for(const [key,val] of Object.entries(params))url.searchParams.set(key,val);
  const resp=await fetch(url,{method,mode:"cors",cache:"no-store",
    headers:{"Content-Type":"application/json","X-Outlier-Admin-Token":state.token},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await resp.json().catch(()=>null);
  if(!resp.ok)throw Error(result?.error||"Request failed ("+resp.status+")");
  return result;
}
function metric(label,value){
  const box=element("div","metric");box.append(element("span","",label.toUpperCase()));
  box.append(element("strong","",value??"—"));return box;
}
async function loadMetrics(){
  const result=await request("admin-metrics");const m=result.metrics||{},r=result.reviews||{},q=result.quality||{};
  metrics.replaceChildren(
    metric("Daily completion",m.completionPercent===undefined?"—":m.completionPercent+"%"),
    metric("Official players",m.uniquePlayers??0),
    metric("Next-day return",m.day1Percent===null?"Not enough data":m.day1Percent===undefined?"—":m.day1Percent+"%"),
    metric("Seven-day return",m.day7Percent===null?"Not enough data":m.day7Percent===undefined?"—":m.day7Percent+"%"),
    metric("Rejected guesses this week",q.rejectedGuesses??"—"),
    metric("Games affected",q.gamesWithRejectedGuesses??"—"),
    metric("Pending reviews",(r.pending??0)+(r.needsMoreInfo??0)),
    metric("Private ranked questions",result.readiness?.verifiedQuestions??0)
  );
  if(result.readiness?.ready===false)say(
    "Ranked launch blocked until all private questions pass validation. Invalid rows: "+
    (result.readiness?.invalidQuestions??0)+".");
}
function reviewCard(row){
  const wrap=element("article","review");
  const head=element("div","review-head");head.append(
    element("span","tag",row.status||"pending"),
    element("small","",row.createdAt?new Date(row.createdAt).toLocaleString():"")
  );wrap.append(head);
  wrap.append(element("h3","",row.prompt||"Archived question"));
  wrap.append(element("div","answer","Suggested answer: "+(row.submitted||"")));
  wrap.append(element("p","reason",row.reason||"No reason supplied"));
  wrap.append(element("small","","Question ID: "+(row.questionId||"")));
  if(row.note)wrap.append(element("p","decision","Editorial note: "+row.note));
  if(row.status==="pending"||row.status==="needs_more_info"){
    const form=element("form","review-action-form");
    const label=element("label","","Review note (12–750 characters, required)"),textarea=element("textarea");
    textarea.required=true;textarea.minLength=12;textarea.maxLength=750;
    textarea.placeholder="Citation checked, why this should count, or why it cannot…";
    form.append(label,textarea);
    const actions=element("div","review-actions");
    for(const [kind,text] of [["approved","APPROVE SUGGESTION"],["rejected","REJECT"],["needs_more_info","REQUEST MORE INFO"]]){
      const b=element("button",kind==="approved"?"":"secondary",text);
      b.type="button";
      b.addEventListener("click",async()=>{
        if(state.busy)return;
        const note=textarea.value.trim();
        if(note.length<12){say("A clear review note of at least 12 characters is required.");textarea.focus();return;}
        if(kind==="approved" && !window.confirm("Mark this suggestion approved? Existing scores and sealed answer sets will NOT change."))return;
        setBusy(true);
        try{
          await request("admin-review-decision",{method:"POST",
            body:{reviewId:row.id,status:kind,note}});
          say("Decision recorded. Add an approved alias to a new, versioned question set before using it in future ranked play.");
          await Promise.all([loadMetrics(),loadReviews()]);
        }catch(error){say("Decision failed: "+error.message)}
        finally{setBusy(false);}
      });actions.append(b);
    }
    form.append(actions);wrap.append(form);
  }
  return wrap;
}
async function loadReviews(){
  const filter=$('#review-status').value;
  const result=await request("admin-review-queue",{params:{status:filter}});
  reviews.replaceChildren();
  const rows=Array.isArray(result.reviews)?result.reviews:[];
  if(!rows.length)reviews.append(element("p","muted","No reports in this view."));
  else for(const row of rows)reviews.append(reviewCard(row));
}
async function refresh(){
  setBusy(true);
  try{await Promise.all([loadMetrics(),loadReviews()]);}
  catch(error){say("Couldn't load review data: "+error.message)}
  finally{setBusy(false);}
}
$('#admin-login').addEventListener("submit",async e=>{
  e.preventDefault();
  if(!state.api){say("Supabase has not been configured. See the online setup guide.");return;}
  const field=$('#owner-token');state.token=field.value;field.value="";
  await refresh();
  if(metrics.childElementCount){workspace.hidden=false;$('#connection').hidden=true;}
});
$('#refresh-reviews').addEventListener("click",refresh);
$('#review-status').addEventListener("change",refresh);
try{
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL))throw Error("Supabase isn't configured yet.");
  state.api=SUPABASE_URL.replace(/\/$/,"")+"/functions/v1/outlier";
  base.textContent="Connect to your owner's hosted OUTLIER review service.";
}catch(error){base.textContent=error.message;$('#connect-button').disabled=true;}
