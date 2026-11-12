import { ONLINE_ENABLED, SUPABASE_URL, SUPABASE_ANON_KEY } from "./online-config.js";

const escape = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const number = value => Number(value ?? 0).toLocaleString("en-US");
let container, onBack, supabase, state, timer, busy = false;

function stopTimer() { if (timer) clearInterval(timer); timer = null; }
function notice(message, style = "") {
  return '<div class="online-notice '+style+'" role="status">'+escape(message)+'</div>';
}
function shell(content) {
  return '<section class="online-wrap">' +
    '<div class="topbar"><button class="back-link" data-online="back">← BACK TO THE FREE GAME</button>' +
    '<span class="session-pill">OUTLIER · ONLINE BETA</span></div>' + content + '</section>';
}
function act(id,label,cl="btn-primary",other="") {
  return '<button class="btn '+cl+'" type="button" data-online="'+id+'" '+other+'>'+label+'</button>';
}
function setView(body) { container.innerHTML = shell(body); window.scrollTo(0,0); }
function showBusy(label="Connecting to the league...") {
  setView('<div class="loading"><div class="spinner"></div><p>'+escape(label)+'</p></div>');
}
function showError(e,context="Something went wrong") {
  state.error = typeof e?.message === "string" ? e.message.replace(/_/g," ") : context;
  console.error("OUTLIER online:",context,e);
  showMenu();
}
function friendly(day) {
  if (!day) return "Practice";
  return new Date(day+"T12:00:00Z").toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"});
}

async function invoke(action,{method="GET",payload=null,auth=true,query=""}={}) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (auth && !token) throw new Error("Please sign in first.");
  const res = await fetch(SUPABASE_URL.replace(/\/$/,"")+"/functions/v1/outlier?action="+
    encodeURIComponent(action)+(query?"&"+query:""),{
    method,
    headers:{
      apikey:SUPABASE_ANON_KEY,
      ...(token ? {Authorization:"Bearer "+token} : {}),
      ...(payload===null ? {} : {"Content-Type":"application/json"})
    },
    ...(payload === null ? {} : {body:JSON.stringify(payload)})
  });
  const body = await res.json().catch(()=>({error:"Bad server response"}));
  if (!res.ok) {
    const error = new Error(body?.error || "Server error");
    error.status = res.status;
    throw error;
  }
  return body;
}
async function reloadProfile() {
  if (!state.user) return;
  const result = await invoke("profile");
  state.profile = result;
}
async function reloadBoard() {
  const result = await invoke("leaderboard",{auth:false,query:"board="+encodeURIComponent(state.board)});
  state.players = Array.isArray(result.players) ? result.players : [];
}
function boardUI() {
  const headings = {daily:"TODAY'S TOP MINDS",average:"BEST LIFETIME AVERAGE",total:"MOST LIFETIME POINTS"};
  const rows = state.players.map(player=>
    '<div class="leader-row '+(state.user?.id===player.userId?'is-me':'')+'">'+
    '<div class="leader-rank">'+number(player.position)+'</div>'+
    '<div class="leader-name">'+escape(player.name)+(state.user?.id===player.userId?' <small>YOU</small>':'')+'</div>'+
    '<div class="leader-score">'+number(player.score)+'<small>'+number(player.days)+' days</small></div></div>'
  ).join("");
  return '<div class="card online-board"><div class="section-heading"><div><span class="eyebrow">GLOBAL LEADERBOARD</span>'+
    '<h3>'+headings[state.board]+'</h3></div><span class="pill pill-teal">SERVER VERIFIED</span></div>'+
    '<div class="board-tabs">'+[["daily","DAILY"],["average","LIFETIME AVG"],["total","LIFETIME TOTAL"]]
      .map(([id,label])=>'<button class="board-tab '+(state.board===id?"active":"")+
        '" data-online="board" data-board="'+id+'">'+label+'</button>').join("")+'</div>'+
    (rows || '<div class="board-empty"><div class="big-icon">🏁</div><h3>No ranked scores yet</h3>'+
       '<p class="muted small">Be the first to finish an official online daily game.</p></div>')+
    '<p class="small muted" style="margin-top:20px">'+
      (state.board==="average"?"Players need at least 10 completed daily games to qualify. ":
      state.board==="daily"?"Only today's one official daily attempt counts. ":
      "Only official daily scores accumulate. ") +
      'Unlimited practice never affects these rankings.</p></div>';
}
function profilePanel() {
  if (!state.profile) return "";
  const s=state.profile.stats || {};
  return '<div class="card online-profile"><div class="online-profile-head"><div><span class="eyebrow">YOUR ACCOUNT</span>'+
     '<h3>'+escape(state.profile.name||"Player")+'</h3></div>'+
     '<span class="pill '+(state.profile.unlimited?"pill-yellow":"pill-purple")+'">'+
       (state.profile.unlimited?"✦ LIFETIME UNLIMITED":"FREE PLAYER")+'</span></div>'+
     '<div class="online-stats">'+
     '<div><strong>'+number(s.days)+'</strong><small>DAILY GAMES</small></div>'+
     '<div><strong>'+number(s.average)+'</strong><small>LIFETIME AVG</small></div>'+
     '<div><strong>'+number(s.total)+'</strong><small>TOTAL POINTS</small></div>'+
     '<div><strong>'+number(s.best)+'</strong><small>PERSONAL BEST</small></div></div>'+
     '<form class="online-name-form" data-form="name"><label for="online-display">DISPLAY NAME</label>'+
     '<div class="answer-row"><input class="answer-input" id="online-display" name="name" maxlength="24" required value="'+escape(state.profile.name||"")+'">'+
     '<button class="btn btn-ghost" type="submit">SAVE NAME</button></div></form></div>';
}
function showMenu() {
  stopTimer();
  state.view = "menu";
  const signedIn=Boolean(state.user);
  const heading='<div class="online-heading"><span class="eyebrow">THE COMPETITIVE LEAGUE</span>'+
   '<h1>PLAY WITH <span class="gradient-text">THE WORLD.</span></h1>'+
   '<p class="muted">One official seven-question run per day. Verified global scores, lifetime rankings, and a $4.99 lifetime unlimited unlock.</p></div>';
  const buttons=signedIn ?
    '<div class="online-menu-actions">'+act("daily","PLAY MY OFFICIAL DAILY →")+
      (state.profile?.unlimited ? act("practice","UNLIMITED PRACTICE ↻","btn-teal") :
      act("checkout","UNLOCK PRACTICE · $4.99 ONCE","btn-ghost"))+
      act("logout","SIGN OUT","btn-outline")+'</div>' :
    '<div class="card online-signup"><span class="pill pill-purple">FREE DAILY GAME</span>'+
    '<h3>Get on the leaderboard.</h3><p class="small muted">Enter your email and we’ll send a secure sign-in link. No password needed.</p>'+
    '<form data-form="login"><label class="answer-label" for="online-email">EMAIL ADDRESS</label>'+
    '<div class="answer-row"><input class="answer-input" id="online-email" type="email" required autocomplete="email" placeholder="you@example.com">'+
    '<button class="btn btn-primary" type="submit">SEND LINK</button></div></form>'+
    (state.sent ? notice("Check your email for your sign-in link.","ok") : "")+'</div>';
  setView(heading + (state.error ? notice(state.error,"warning") : "")+
    (state.message ? notice(state.message,"ok") : "")+
    buttons + profilePanel() + boardUI());
}
function formatTime(deadline) {
  if (!deadline) return 45;
  return Math.max(0,Math.ceil((new Date(deadline).getTime()-Date.now())/1000));
}
function tick() {
  if (state.view !== "game" || !state.game?.question?.deadline) return;
  const seconds=formatTime(state.game.question.deadline);
  const label=container.querySelector(".online-timer");
  if (label) {
    label.textContent='0:'+String(seconds).padStart(2,'0');
    label.classList.toggle("urgent",seconds<=10);
  }
  const progress=container.querySelector(".online-timebar");
  if (progress) progress.style.width=Math.max(0,Math.min(100,seconds/45*100))+"%";
  if (seconds===0 && !busy) submitAnswer(null);
}
function showGame() {
  stopTimer();
  if (!state.game) return showMenu();
  if (state.game.complete) return showResults();
  if (!state.game.question?.deadline) return readyNext();
  state.view="game";
  const q=state.game.question;
  const isFit=q.type==="fit";
  const options=isFit ?
    '<div class="fit-options">'+(q.choices||[]).map((choice,index)=>
      '<button class="fit-option" data-online="pick" data-answer="'+escape(choice)+'"><span>'+escape(choice)+'</span><span>'+
      String.fromCharCode(65+index)+'</span></button>').join("")+'</div>' :
    '<form data-form="answer"><label class="answer-label" for="online-answer">YOUR MOST UNEXPECTED CORRECT ANSWER</label>'+
    '<div class="answer-row"><input class="answer-input" maxlength="100" id="online-answer" required autocomplete="off" placeholder="Type your answer...">'+
    '<button type="submit" class="btn btn-primary">LOCK IT IN →</button></div></form>';
  setView('<div class="game-head"><div><span class="eyebrow">VERIFIED '+(state.game.mode==="daily"?"DAILY GAME":"UNRANKED PRACTICE")+'</span>'+
    '<h2>Question '+(state.game.index+1)+' / 7</h2></div><div class="game-score"><div class="tiny muted">YOUR SCORE</div>'+
    '<strong>'+number(state.game.score)+'</strong></div></div>'+
    '<div class="progress-track"><div class="progress-fill" style="width:'+(state.game.index/7*100)+'%"></div></div>'+
    '<article class="card question-card '+q.type+'"><div class="question-head"><span class="pill '+(isFit?"pill-teal":"pill-purple")+'">'+
    (isFit?"◎ FIT IN · MATCH THE CROWD":"✦ STAND OUT · BE DIFFERENT")+'</span>'+
    '<span class="timer online-timer">0:45</span></div><div class="time-track"><div class="time-fill online-timebar"></div></div>'+
    '<div class="question-category">'+escape(q.category)+'</div><h2 class="question-prompt">'+escape(q.prompt)+'</h2>'+
    '<p class="question-detail">'+escape(isFit?"Pick what you think most people would say.":q.detail)+'</p>'+
    options + '<div class="question-foot"><span>'+(isFit?"TOP CROWD CHOICE = 1,000":"RARE CORRECT ANSWERS SCORE MORE")+
    '</span><button class="skip" data-online="skip">SKIP</button></div></article>'+
    '<p class="text-center small muted" style="margin-top:18px">The server checks your answer and enforces the 45-second limit.</p>');
  container.querySelector("#online-answer")?.focus({preventScroll:true});
  tick();
  timer=setInterval(tick,180);
}
function readyNext() {
  stopTimer();
  state.view="ready";
  setView('<div class="card online-ready"><span class="eyebrow">NEXT ROUND</span><h2>Ready to continue?</h2>'+
    '<p class="muted">Your 45-second clock starts only when you press the button.</p>'+
    act("next","START QUESTION "+(state.game.index+1)+" →")+'</div>');
}
function showFeedback() {
  stopTimer();
  state.view="feedback";
  const f=state.feedback?.feedback;
  const reveal=Array.isArray(state.feedback?.reveal)?state.feedback.reveal:[];
  if (!f) return showGame();
  const isFit=f.type==="fit";
  const title=f.valid?(f.points>=850?"AMAZING PICK!":f.points>=500?"NICE WORK!":"POINTS ON THE BOARD!"):"NO POINTS THIS TIME";
  const examples=reveal.map(entry=> {
    const percent=isFit?entry.share:Math.round(entry.points/10);
    return '<div class="bar-row '+(entry.name===f.accepted?"selected":"")+'"><div class="bar-label"><span>'+
      escape(entry.name)+(entry.name===f.accepted?" ★ YOU":"")+'</span><span>'+
      (isFit?number(entry.share)+"%":number(entry.points)+" pts")+'</span></div>'+
      '<div class="bar-bg"><div class="bar-fg" style="width:'+Math.max(0,percent)+'%"></div></div></div>';
  }).join("");
  setView('<div class="card feedback-card '+f.type+'"><div class="text-center"><div class="feedback-graphic">'+
    (isFit?"◎":"💎")+'</div><div class="eyebrow">SERVER VERIFIED</div><h2 class="feedback-title">'+title+'</h2>'+
    '<div class="feedback-points gradient-text">+'+number(f.points)+'</div><p class="muted">'+
    escape(f.accepted||"No accepted answer")+'</p><span class="pill pill-yellow">TOTAL '+number(state.game.score)+' PTS</span></div>'+
    '<div class="feedback-divider"></div><h3>'+(isFit?"Crowd response board":"Some of the highest-scoring answers")+
    '</h3>'+examples+
    '<p class="insight">Prototype crowd shares and rarity rankings are fixed examples. Online points are calculated on the server.</p>'+
    act("next",state.game.complete?"SEE FINAL RESULTS →":"NEXT QUESTION →",isFit?"btn-teal btn-wide feedback-next":"btn-primary btn-wide feedback-next")+
    '</div>');
}
function showResults() {
  stopTimer();
  state.view="results";
  const g=state.game;
  const answers=Array.isArray(g?.answers)?g.answers:[];
  const rare=answers.filter(x=>x.type==="rare").reduce((sum,x)=>sum+x.points,0);
  const fit=answers.filter(x=>x.type==="fit").reduce((sum,x)=>sum+x.points,0);
  const rows=answers.map((a,index)=>'<div class="breakdown-line"><div class="breakdown-name"><span class="mini-icon">'+
    (a.type==="rare"?"💎":"◎")+'</span><span>Q'+(index+1)+' · '+escape(a.category)+' · '+escape(a.accepted||"No valid answer")+
    '</span></div><b>+'+number(a.points)+'</b></div>').join("");
  setView('<div class="card result-scorecard"><div class="result-crown">🏆</div>'+
    '<div class="eyebrow">OFFICIAL '+(g.mode==="daily"?"DAILY":"PRACTICE")+' RESULTS</div>'+
    '<div class="result-number gradient-text">'+number(g.score)+'</div><div class="result-max">OUT OF 7,000</div>'+
    '<h2 class="result-title">'+(g.score>=5700?"THE OUTLIER":g.score>=4400?"BIG BRAIN ENERGY":"KEEP CLIMBING")+'</h2>'+
    '<div class="score-tiles">'+answers.map(a=>'<div class="score-tile '+a.type+'"><span class="tile-icon">'+
      (a.points>=800?"✦":a.points>=500?"●":a.points>0?"◇":"×")+'</span><small>'+number(a.points)+'</small></div>').join("")+
    '</div><div class="result-actions">'+act("share","COPY MY SCORE ↗")+act("menu","BACK TO LEADERBOARDS","btn-ghost")+
    (state.profile?.unlimited ? act("practice","PLAY AGAIN ↻","btn-teal"):"")+'</div></div>'+
    '<div class="card result-modes"><div class="mode-stat rare"><span>💎 STAND OUT</span><strong>'+number(rare)+'</strong>'+
    '</div><div class="mode-stat fit"><span>◎ FIT IN</span><strong>'+number(fit)+'</strong></div></div>'+
    '<div class="card result-breakdown"><h3>Round by round</h3>'+rows+'</div>'+
    '<p class="small muted text-center" style="margin-top:20px">'+
    (g.mode==="daily"?"One official attempt per UTC day. Practice never counts toward the public leaderboards.":
     "This practice result does not affect your lifetime rankings.")+'</p>');
}
async function submitAnswer(response) {
  if (busy || state.view!=="game" || !state.game) return;
  busy=true;stopTimer();
  try {
    const result=await invoke("answer", {method:"POST",payload:{
      game:state.game.id,index:state.game.index,response
    }});
    state.game=result.state;
    state.feedback=result;
    showFeedback();
  } catch(e) {
    state.message= e.message === "incorrect_question_index" ? "Your session changed; reloading it." : "Could not submit your answer. "+e.message;
    await resumeGame().catch(()=>showError(e,"Answer could not be submitted"));
  } finally {busy=false;}
}
async function resumeGame() {
  if (!state.game) return showMenu();
  const result=await invoke("state",{query:"game="+encodeURIComponent(state.game.id)});
  state.game=result.game;
  if (state.game.complete) showResults();
  else if (state.game.question?.deadline) showGame();
  else readyNext();
}
async function start(mode) {
  if (busy) return;
  busy=true;showBusy("Loading your "+(mode==="daily"?"daily game":"practice run")+"...");
  try {
    const data=await invoke("start",{method:"POST",payload:{mode}});
    state.game=data.game;
    state.feedback=null;
    if (state.game.complete) showResults();
    else if (state.game.question?.deadline) showGame();
    else readyNext();
  } catch(e) {
    if (e.status===402) state.message="Unlimited rounds require a one-time $4.99 unlock.";
    showError(e,"Could not start game");
  } finally {busy=false;}
}
async function advance() {
  if (busy || !state.game) return;
  if (state.game.complete) {await reloadProfile().catch(()=>{});showResults();return;}
  busy=true;showBusy("Warming up the next question...");
  try {
    const result=await invoke("advance",{method:"POST",payload:{game:state.game.id,index:state.game.index}});
    state.game=result.game;
    showGame();
  } catch(e) { showError(e,"Could not advance round"); }
  finally {busy=false;}
}
async function checkout() {
  if (busy) return;busy=true;
  try {
    const result=await invoke("checkout",{method:"POST",payload:{}});
    const url=new URL(result.url);
    if (url.protocol!=="https:" || url.hostname!=="checkout.stripe.com") throw new Error("Unexpected checkout URL");
    window.location.assign(url.href);
  } catch(e) {showError(e,"Checkout could not open");}
  finally {busy=false;}
}
async function handleClick(event) {
  const button=event.target.closest("[data-online]");
  if (!button || !container.contains(button)) return;
  const action=button.dataset.online;
  if (action==="back") {stopTimer();container.onclick=null;container.onsubmit=null;window.removeEventListener("keydown",onKeydown);onBack();return;}
  if (busy) return;
  if (action==="board") {
    state.board=button.dataset.board;
    showBusy("Loading rankings...");
    try {await reloadBoard(); showMenu();}catch(e){showError(e);}
  }
  if (action==="daily") await start("daily");
  if (action==="practice") await start("practice");
  if (action==="checkout") await checkout();
  if (action==="menu") {await Promise.all([reloadBoard(),reloadProfile()]).catch(()=>{});showMenu();}
  if (action==="next") await advance();
  if (action==="pick") await submitAnswer(button.dataset.answer);
  if (action==="skip") await submitAnswer(null);
  if (action==="share") {
    const text="OUTLIER "+friendly(state.game.day)+"\n"+number(state.game.score)+"/7,000\n4 Stand Out · 3 Fit In\n"+
      window.location.origin+window.location.pathname;
    try {await navigator.clipboard.writeText(text);state.message="Score copied!";}catch{state.message="Could not copy in this browser.";}
    showResults();
  }
  if (action==="logout") {
    await supabase.auth.signOut();
    state.user=null;state.profile=null;state.game=null;
    showMenu();
  }
}
async function handleSubmit(event) {
  const form=event.target.closest("[data-form]");
  if (!form) return;
  event.preventDefault();
  if (busy) return;
  if (form.dataset.form==="answer") return submitAnswer(container.querySelector("#online-answer")?.value?.trim()||null);
  if (form.dataset.form==="login") {
    const email=String(container.querySelector("#online-email")?.value||"").trim();
    if (!email) return;
    busy=true;
    try {
      const redirectTo=window.location.origin+window.location.pathname+"?online=1";
      const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo}});
      if (error) throw error;
      state.sent=true;state.error=null;showMenu();
    } catch(e) {showError(e,"Sign-in link failed");}
    finally {busy=false;}
  }
  if (form.dataset.form==="name") {
    busy=true;
    try {
      const result=await invoke("profile",{method:"PATCH",payload:{name:container.querySelector("#online-display")?.value}});
      state.profile.name=result.name; state.message="Display name updated.";
      showMenu();
    } catch(e) {showError(e,"Name could not be updated");}
    finally {busy=false;}
  }
}
function onKeydown(event) {
  if (state.view!=="game" || state.game?.question?.type!=="fit" || event.repeat ||
      event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target instanceof Element && event.target.closest("input,textarea,select")) return;
  const key=event.key.toUpperCase();
  const a="ABCDEF".indexOf(key);
  const b="123456".indexOf(key);
  const index=a>=0?a:b;
  if (index>=0) {const button=container.querySelectorAll(".fit-option")[index];if(button){event.preventDefault();button.click();}}
}
export async function mountOnline(element, back) {
  container=element;onBack=back;
  state={view:"loading",board:"daily",players:[],user:null,profile:null,game:null,feedback:null,error:null,message:null,sent:false};
  showBusy();
  if (!ONLINE_ENABLED) {
    setView('<div class="card online-ready"><h2>Online mode is not connected yet.</h2>'+
      '<p class="muted">This deployment needs a Supabase project and the server setup from the repository. The local daily game still works.</p>'+
      act("back","BACK TO GAME")+'</div>');
    container.onclick=handleClick;
    return;
  }
  container.onclick=handleClick;
  container.onsubmit=handleSubmit;
  window.addEventListener("keydown",onKeydown);
  try {
    // SDK only loads when backend is configured and the player enters online mode.
    const sdk=await import("https://esm.sh/@supabase/supabase-js@2.49.10");
    supabase=sdk.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{
      auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,flowType:"pkce"}
    });
    const {data,error}=await supabase.auth.getSession();
    if (error) throw error;
    state.user=data.session?.user ?? null;
    if (state.user) await reloadProfile();
    await reloadBoard();
    const params=new URLSearchParams(window.location.search);
    if (params.get("checkout")==="success") {
      state.message="Payment return received. Lifetime access appears after Stripe confirms it; reload if necessary.";
    }
    showMenu();
  } catch (e) {state.error="Connection is unavailable. Check the hosted API setup. "+(e?.message||"");showMenu();}
}
