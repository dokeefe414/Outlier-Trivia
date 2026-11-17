// Isolated browser test for nickname-only private rooms. No live accounts used.
import {chromium} from "playwright";
import assert from "node:assert/strict";
const base=process.env.OUTLIER_TEST_URL||"http://127.0.0.1:8000/";
const guestId="a1111111-1111-4111-8111-111111111111";
const roomId="a3333333-3333-4333-8333-333333333333";
const inviteCode="aabbccddeeff";
const sdkCode=[
 "const state=globalThis.__mockGuest={user:null,calls:0,disabled:false,subscriber:null};",
 "export function createClient(){return {auth:{",
 "getUser:async()=>({data:{user:state.user},error:state.user?null:{name:'AuthSessionMissingError',message:'Auth session missing'}}),",
 "getSession:async()=>({data:{session:state.user?{access_token:'mock-token'}:null}}),",
 "signInAnonymously:async()=>{",
 "state.calls++;",
 "if(state.disabled)return {data:{user:null},error:{message:'Anonymous sign-ins are disabled'}};",
 "state.user={id:'a1111111-1111-4111-8111-111111111111',is_anonymous:true,app_metadata:{provider:'anonymous'}};",
 "state.subscriber?.('SIGNED_IN',{user:state.user});",
 "return {data:{user:state.user},error:null};",
 "},",
 "onAuthStateChange:fn=>{state.subscriber=fn;return {data:{subscription:{unsubscribe(){state.subscriber=null}}}};},",
 "updateUser:async()=>({data:{user:state.user},error:null}),",
 "signOut:async()=>{state.user=null;state.subscriber?.('SIGNED_OUT',null);return {error:null};}",
 "}}}"
].join("\n");
const browser=await chromium.launch({headless:true});
async function run({invite=false,disabled=false,mobile=false}={}){
 const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1100,height:800},reducedMotion:"reduce"});
 const page=await ctx.newPage();page.setDefaultTimeout(18000);
 const calls={names:[],created:0,joined:0,states:0,missingToken:0};
 await page.route("https://esm.sh/@supabase/supabase-js@2.49.10",route=>route.fulfill({
   status:200,contentType:"application/javascript",body:sdkCode,
   headers:{"Access-Control-Allow-Origin":"*"}
 }));
 await page.route("https://ljmqtdwcwpatyecxtues.supabase.co/functions/v1/outlier**",async route=>{
   const request=route.request(),action=new URL(request.url()).searchParams.get("action");
   if(["profile","party-create","party-join","party-state"].includes(action)
     &&request.headers().authorization!=="Bearer mock-token"){
     calls.missingToken++;return route.fulfill({status:401,contentType:"application/json",
       body:'{"error":"missing_token"}',headers:{"Access-Control-Allow-Origin":"*"}});
   }
   let data={};
   if(action==="capabilities")data={partyReady:true,rankedReady:false,paymentReady:false};
   else if(action==="leaderboard")data={players:[]};
   else if(action==="profile"){
     const payload=request.method()==="PATCH"?JSON.parse(request.postData()||"{}"):{};
     if(request.method()==="PATCH")calls.names.push(payload.name);
     data=request.method()==="PATCH"?{name:payload.name}:
       {name:calls.names.at(-1)||"Guest",stats:{},history:[],reviews:[]};
   }else if(action==="party-create"){calls.created++;data={room:{id:roomId,code:inviteCode}};}
   else if(action==="party-join"){calls.joined++;
     assert.equal(JSON.parse(request.postData()).code,inviteCode);
     data={room:{id:roomId}};
   }else if(action==="party-state"){
     calls.states++;
     data={room:{id:roomId,code:inviteCode,phase:"waiting",
       host:invite?"a2222222-2222-4222-8222-222222222222":guestId,
       targetPlayers:2,roundSeconds:45,seriesGame:1,seriesLength:1,
       themeVotes:[],serverTime:new Date().toISOString(),
       players:[
        ...(invite?[{id:"a2222222-2222-4222-8222-222222222222",name:"Host",ready:false,active:true}]:[]),
        {id:guestId,name:calls.names.at(-1)||"Guest",ready:false,active:true}
       ]}};
   }
   return route.fulfill({status:200,contentType:"application/json",
     headers:{"Access-Control-Allow-Origin":"*"},body:JSON.stringify(data)});
 });
 await page.goto(new URL(invite?"?room="+inviteCode:"",base).href);
 await page.evaluate(async()=>{
   const root=document.createElement("main");root.id="guest-test-root";document.body.appendChild(root);
   const {mountOnline}=await import("/src/online.js");
   await mountOnline(root,()=>{});
 });
 await page.locator("#guest-test-root form[data-form='guest-party']").waitFor();
 assert.equal(await page.evaluate(()=>globalThis.__mockGuest.calls),0,
   "An opened invite must not create a hidden guest user");
 assert.equal(calls.created+calls.joined,0,"Nobody joins merely by opening an invite");
 if(disabled)await page.evaluate(()=>globalThis.__mockGuest.disabled=true);
 await page.locator("#guest-test-root #guest-room-nickname").fill("Brian");
 if(invite){
   assert.equal(await page.locator("#guest-test-root #guest-room-code").inputValue(),inviteCode);
   await page.locator("#guest-test-root button[value='join']").click();
 }else await page.locator("#guest-test-root button[value='create']").click();
 if(disabled){
   await page.locator("#guest-test-root .online-notice.warning").waitFor();
   assert.match(await page.locator("#guest-test-root .online-notice.warning").innerText(),/Anonymous Sign-Ins enabled/i);
   assert.equal(calls.created+calls.joined,0);
 }else{
   await page.locator("#guest-test-root .online-party-waiting").waitFor();
   assert.deepEqual(calls.names,["Brian"]);
   assert.equal(calls.created,invite?0:1);assert.equal(calls.joined,invite?1:0);
   assert.ok(calls.states>0);assert.equal(calls.missingToken,0);
   assert.match(await page.locator("#guest-test-root .online-party-waiting").innerText(),/Brian/);
   assert.equal(await page.locator("#guest-test-root #online-email").count(),0,
     "Guest room cannot require an email form");
   if(mobile){
     const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
     assert.ok(bounds.scroll<=bounds.width+2,"Guest room must fit a 390px screen");
   }
 }
 await ctx.close();
 console.log("PASS guest "+(invite?"invite":"create")+(disabled?" provider-off":"")+(mobile?" mobile":""));
}
try{await run();await run({invite:true,mobile:true});await run({disabled:true});}
finally{await browser.close();}
