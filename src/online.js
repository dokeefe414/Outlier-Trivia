import {rarityTier} from "./answer-intelligence.js";
import {readLeagueInvite,leagueInviteLink,removeLeagueInvite,officialShareMessage,comparisonLabel} from "./community.js";
import { ONLINE_ENABLED, SUPABASE_URL, SUPABASE_ANON_KEY } from "./online-config.js";
import { dailyDebrief, weeklyCup } from "./v13-discovery.js";

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
async function reloadCapabilities() {
  try { state.capabilities=await invoke("capabilities",{auth:false}); }
  catch(error){ state.capabilities={rankedReady:false,paymentReady:false};
    state.message="The competitive server has not been verified as ready yet."; }
}
async function reloadProfile() {
  if (!state.user) return;
  const result = await invoke("profile");
  state.profile = result;
}
async function reloadLeagues() {
  if(!state.user){state.leagues=[];return;}
  const response=await invoke("leagues");
  state.leagues=Array.isArray(response.leagues)?response.leagues:[];
}
async function reloadLeagueStandings() {
  const id=state.activeLeague?.id;
  if(!id) return;
  const response=await invoke("league-standings",{
    query:"league="+encodeURIComponent(id)+"&period="+encodeURIComponent(state.leaguePeriod)
  });
  state.leaguePlayers=Array.isArray(response.players)?response.players:[];
}
async function reloadRivalry() {
  if(!state.activeLeague?.id||!state.rivalId)throw new Error("Choose a league rival.");
  const data=await invoke("rivalry",{
    query:"league="+encodeURIComponent(state.activeLeague.id)+
      "&opponent="+encodeURIComponent(state.rivalId)+"&days=14"
  });
  state.rivalry=data.rivalry;
}
async function reloadBoard() {
  const result = await invoke("leaderboard",{auth:false,query:"board="+encodeURIComponent(state.board)});
  state.players = Array.isArray(result.players) ? result.players : [];
}
function boardUI() {
  const headings = {daily:"TODAY'S TOP MINDS",week:"THIS WEEK'S TOP MINDS",average:"BEST LIFETIME AVERAGE",total:"MOST LIFETIME POINTS"};
  const rows = state.players.map(player=>
    '<div class="leader-row '+(state.user?.id===player.userId?'is-me':'')+'">'+
    '<div class="leader-rank">'+number(player.position)+'</div>'+
    '<div class="leader-name">'+escape(player.name)+(state.user?.id===player.userId?' <small>YOU</small>':'')+'</div>'+
    '<div class="leader-score">'+number(player.score)+'<small>'+number(player.days)+' days</small></div></div>'
  ).join("");
  return '<div class="card online-board"><div class="section-heading"><div><span class="eyebrow">GLOBAL LEADERBOARD</span>'+
    '<h3>'+headings[state.board]+'</h3></div><span class="pill pill-teal">SERVER VERIFIED</span></div>'+
    '<div class="board-tabs">'+[["daily","DAILY"],["week","WEEKLY"],["average","LIFETIME AVG"],["total","LIFETIME TOTAL"]]
      .map(([id,label])=>'<button class="board-tab '+(state.board===id?"active":"")+
        '" data-online="board" data-board="'+id+'">'+label+'</button>').join("")+'</div>'+
    (rows || '<div class="board-empty"><div class="big-icon">🏁</div><h3>No ranked scores yet</h3>'+
       '<p class="muted small">Be the first to finish an official online daily game.</p></div>')+
    '<p class="small muted" style="margin-top:20px">'+
      (state.board==="average"?"Players need at least 10 completed daily games to qualify. ":
      state.board==="daily"?"Only today's one official daily attempt counts. ":
      state.board==="week"?"Weekly rankings reset Monday at 00:00 UTC. " :
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
     '<button class="btn btn-ghost" type="submit">SAVE NAME</button></div></form>'+
     '<div class="v13-crowd-consent"><div class="eyebrow">OPT-IN CROWD RESEARCH</div>'+
     '<p class="small muted">Let your completed official Fit In predictions and Stand Out picks made AFTER you opt in contribute anonymously to historical comparisons. Only groups with 30+ responses appear. Withdrawing excludes all your prior submissions from future crowd results.</p>'+
     '<button class="btn btn-ghost" type="button" data-online="crowd-consent" data-enabled="'+
       (state.profile.crowdOptIn?"false":"true")+'">'+
       (state.profile.crowdOptIn?"WITHDRAW CROWD RESEARCH CONSENT":"OPT IN TO CROWD RESEARCH")+'</button>'+
     '<span class="small muted"> CURRENTLY '+(state.profile.crowdOptIn?"OPTED IN":"OFF")+'</span></div></div>';
}

function myReviewsPanel() {
  const tickets=Array.isArray(state.profile?.reviews)?state.profile.reviews:[];
  if(!tickets.length)return "";
  return '<section class="card reviews-status-panel"><div class="eyebrow">YOUR ANSWER REPORTS</div>'+
    '<h3>Making the library better, together.</h3>'+
    '<p class="small muted">Decisions do not retroactively change published daily scores.</p>'+
    tickets.slice(0,6).map(row=>'<div class="review-status-item">'+
      '<strong>'+escape(row.answer||"Unknown answer")+'</strong>'+
      '<span class="pill">'+escape((row.status||"pending").replaceAll("_"," ").toUpperCase())+'</span>'+
      (row.note?'<p>'+escape(row.note)+'</p>':'')+'</div>').join('')+'</section>';
}
function onlineJourney() {
  const entries=Array.isArray(state.profile?.history)?state.profile.history:[];
  if(!entries.length)return "";
  const recent=[...entries].slice(0,14);
  const best=Math.max(...entries.map(x=>x.score));
  return '<div class="card online-journey"><div class="eyebrow">YOUR OFFICIAL JOURNEY</div>'+
    '<h3>Progress worth coming back for.</h3><div class="online-journey-grid">'+
    recent.map(item=>'<div title="'+escape(item.day)+' · '+number(item.score)+' points">'+
      '<span style="height:'+Math.max(8,item.score/70)+'%"></span></div>').join("")+
    '</div><div class="journey-metrics"><div><small>RECENT RUNS</small><strong>'+recent.length+'</strong></div>'+
    '<div><small>BEST IN HISTORY</small><strong>'+number(best)+'</strong></div></div></div>';
}
function leaguesPanel() {
  if(!state.user)return "";
  const cards=(state.leagues||[]).map(item=>'<div class="league-card"><div>'+
    '<strong>🏆 '+escape(item.title)+'</strong><small>'+number(item.members)+' / 50 MEMBERS</small>'+
    '</div><div class="league-card-actions">'+
    '<button type="button" data-online="league-view" data-id="'+escape(item.id)+'">VIEW STANDINGS</button>'+
    '<button type="button" data-online="league-copy" data-code="'+escape(item.code)+'">COPY INVITE LINK</button>'+
    '</div></div>').join("");
  return '<div class="card league-panel"><div class="section-heading"><div>'+
    '<span class="eyebrow">YOUR INNER CIRCLE</span><h3>Build your own league.</h3>'+
    '<p class="small muted">Up to 50 friends per league. Only verified official daily games count.</p></div>'+
    '<span class="pill pill-purple">'+(state.leagues?.length||0)+' LEAGUES</span></div>'+
    (cards||'<p class="muted small">No leagues yet. Create one and challenge your friends.</p>')+
    '<div class="league-forms">'+
      '<form data-form="league-create"><label for="league-name">NEW LEAGUE NAME</label>'+
      '<input id="league-name" class="answer-input" type="text" minlength="3" maxlength="40" required placeholder="e.g. Campus Brain Battle">'+
      '<button class="btn btn-teal" type="submit">CREATE LEAGUE</button></form>'+
      '<form data-form="league-join"><label for="league-code">JOIN WITH INVITE CODE</label>'+
      '<input id="league-code" class="answer-input" type="text" minlength="12" maxlength="12" required placeholder="12-character invite code">'+
      '<button class="btn btn-ghost" type="submit">JOIN FRIENDS</button></form></div>'+
      '<p class="small muted">Friend leagues are free and never change your daily score. Share invite codes only with people you want in your group.</p></div>';
}

function weeklyCupPanel() {
  if(!["week","last-week"].includes(state.leaguePeriod))return "";
  const cup=weeklyCup(state.leaguePlayers,state.leaguePeriod);
  const rows=cup.matchups.map((match,index)=>{
    const status=match.draw?"TIED":match.winner?
      "LEADING: "+escape(match.winner.name):"NOT YET PLAYED";
    return '<div class="v13-cup-match"><small>MATCH '+(index+1)+'</small>'+
      '<div><span>'+escape(match.a.name)+' <b>'+number(match.a.score)+'</b></span>'+
      '<em>VS</em><span>'+escape(match.b.name)+' <b>'+number(match.b.score)+'</b></span></div>'+
      '<strong>'+status+'</strong></div>';
  }).join("");
  return '<section class="v13-cup" aria-label="Weekly Cup matchups">'+
    '<div class="eyebrow">🏆 '+(cup.final?"LAST WEEK’S":"THIS WEEK’S")+' FRIEND LEAGUE CUP</div>'+
    '<h3>WEEKLY HEAD-TO-HEAD.</h3>'+
    '<p class="small muted">An exhibition matchup from the verified weekly scoreboard. '+
      'Play your one official daily to help your weekly total. '+
      (cup.final?"Last week’s totals are final.":"This week’s totals remain provisional until Sunday 23:59 UTC.")+'</p>'+
    (rows||'<p class="small muted">Invite another player to create your first weekly matchup.</p>')+
    (cup.bye?'<p class="small muted">✦ '+escape(cup.bye.name)+' has a bye in the current pairing.</p>':'')+
    '<p class="small muted">'+escape(cup.note)+'</p></section>';
}

function showLeague() {
  stopTimer();
  if(!state.activeLeague)return showMenu();
  state.view="league";
  const league=state.activeLeague;
  const rows=(state.leaguePlayers||[]).map(player=>
    '<div class="leader-row '+(state.user?.id===player.userId?'is-me':'')+'">'+
    '<span class="leader-rank">'+number(player.position)+'</span>'+
    '<span class="leader-name">'+escape(player.name)+(state.user?.id===player.userId?' <small>YOU</small>':'')+'</span>'+
    '<span class="leader-score">'+number(player.score)+'<small>'+number(player.days)+' days</small></span>'+
    (state.user?.id===player.userId?'':act("rivalry","⚔ DUEL","btn-ghost",
      'data-user="'+escape(player.userId)+'"'))+'</div>'
  ).join("");
  setView('<div class="league-screen"><button class="back-link" data-online="menu">← BACK TO LEAGUES</button>'+
    '<div class="online-heading"><span class="eyebrow">FRIEND LEAGUE</span><h1>🏆 '+escape(league.title)+'</h1>'+
    '<p class="muted">Real scores, real friends. Practice and purchased access do not add points.</p></div>'+
    '<div class="card online-board"><div class="board-tabs">'+
    [["today","TODAY"],["week","THIS WEEK"],["last-week","LAST WEEK"],["all","ALL-TIME"]].map(([period,label])=>
      '<button class="board-tab '+(state.leaguePeriod===period?'active':'')+
      '" data-online="league-period" data-period="'+period+'">'+label+'</button>').join("")+'</div>'+
    (state.leaguePeriod==="week"&&state.leaguePlayers?.[0]?.days>0?
      '<div class="league-spotlight"><span class="eyebrow">CURRENT WEEKLY LEADER</span>'+
      '<strong>🏆 '+escape(state.leaguePlayers[0].name)+'</strong>'+
      '<span>'+number(state.leaguePlayers[0].score)+' verified points · '+
      number(state.leaguePlayers[0].days)+' completed days</span>'+
      '<p class="muted small">The week is still open — the winner is decided Sunday at 23:59 UTC.</p></div>':'')+
    (state.leaguePeriod==="last-week"&&state.leaguePlayers?.[0]?.days>0?
      '<div class="league-spotlight"><span class="eyebrow">LAST WEEK\'S CHAMPION</span>'+
      '<strong>👑 '+escape(state.leaguePlayers[0].name)+'</strong>'+
      '<span>'+number(state.leaguePlayers[0].score)+' verified points</span></div>':'')+
    (rows||'<div class="board-empty"><p class="muted">Nobody has completed an official game yet.</p></div>')+
    weeklyCupPanel()+
    '<div class="league-code"><span>INVITE CODE: <strong>'+escape(league.code)+'</strong></span>'+
    act("league-copy","COPY INVITE CODE","btn-ghost")+'</div></div></div>');
}

function showRivalry() {
  stopTimer();
  const r=state.rivalry;
  if(!r||!state.activeLeague)return showLeague();
  state.view="rivalry";
  const days=Array.isArray(r.days)?r.days:[];
  const you=Number(r.yourWins)||0,them=Number(r.opponentWins)||0,ties=Number(r.ties)||0;
  const youAhead=you>them,draw=you===them;
  const history=days.map(x=>
    '<div class="rivalry-day"><span>'+escape(x.day)+'</span>'+
    '<b>'+number(x.you)+' <small>YOU</small></b>'+
    '<span class="rivalry-versus">VS</span>'+
    '<b>'+number(x.opponent)+' <small>'+escape(r.opponentName)+'</small></b>'+
    '<span class="rivalry-day-outcome '+escape(x.winner)+'">'+
      (x.winner==="you"?"WIN":x.winner==="rival"?"LOSS":"TIE")+'</span></div>'
  ).join("");
  setView('<section class="league-screen rivalry-screen">'+
    '<button class="back-link" data-online="rivalry-back">← BACK TO LEAGUE</button>'+
    '<div class="online-heading"><span class="eyebrow">FRIENDLY RIVALRY · VERIFIED SCORES</span>'+
    '<h1>⚔ YOU <span class="gradient-text">VS '+escape(r.opponentName)+'</span></h1>'+
    '<p class="muted">A head-to-head record over the last 14 UTC days. Only days you both completed the free official game count.</p></div>'+
    '<div class="card rivalry-hero"><div class="rivalry-trophy" aria-hidden="true">'+
       (days.length===0?'◇':draw?'🤝':youAhead?'🏆':'⚡')+'</div>'+
    '<div class="rivalry-scoreline"><div><small>YOUR WINS</small><strong>'+number(you)+'</strong></div>'+
      '<div class="rivalry-divider">— <span>'+number(ties)+' TIES</span> —</div>'+
      '<div><small>'+escape(r.opponentName.toUpperCase())+' WINS</small><strong>'+number(them)+'</strong></div></div>'+
    '<h2>'+(days.length===0?'A RIVALRY IS BORN':draw?'EVENLY MATCHED':
      youAhead?"YOU'RE LEADING":"THE CHASE IS ON")+'</h2>'+
    '<p class="muted">'+(days.length?number(days.length)+' shared official dailies · '+
      'Your current head-to-head win streak: '+number(r.currentWinStreak):
      'Play the same daily question set on the same UTC date to create your first verified comparison.')+'</p>'+
    '<div class="rivalry-actions">'+act("rivalry-invite","SHARE DAILY CHALLENGE ↗","btn-teal")+
      act("rivalry-refresh","REFRESH RESULTS","btn-ghost")+'</div></div>'+
    '<div class="card rivalry-history"><h3>THE LAST 14 DAYS</h3>'+
    (history||'<p class="muted">Nothing to compare yet. Neither player needs to share raw answers.</p>')+
    '<p class="tiny muted">Comparisons are generated server-side from completed official games, never from unverified guest scores. Private leagues only.</p></div></section>');
}

function showMenu() {
  stopTimer();
  state.view = "menu";
  const signedIn=Boolean(state.user);
  const heading='<div class="online-heading"><span class="eyebrow">THE COMPETITIVE LEAGUE</span>'+
   '<h1>PLAY WITH <span class="gradient-text">THE WORLD.</span></h1>'+
   '<p class="muted">One official seven-question run per day. Verified global scores, lifetime rankings, and a $4.99 lifetime unlimited unlock.</p></div>';
  const rankedReady=state.capabilities?.rankedReady===true;
  const paymentReady=state.capabilities?.paymentReady===true;
  const isTestCheckout=state.capabilities?.paymentMode==="test";
  const buttons=signedIn ?
    '<div class="online-menu-actions">'+
      (rankedReady ? act("daily","PLAY MY OFFICIAL DAILY →") :
        '<p class="small muted">Verified daily competition is awaiting its private question bank. The free guest game still works.</p>')+
      (state.profile?.unlimited && rankedReady ? act("practice","UNLIMITED PRACTICE ↻","btn-teal") :
        !state.profile?.unlimited && paymentReady && rankedReady ?
          act("checkout",isTestCheckout?"TRY TEST CHECKOUT · NO CHARGE":"UNLOCK PRACTICE · $4.99 ONCE","btn-ghost") : '')+
      act("restore","CHECK / RESTORE LIFETIME ACCESS","btn-outline")+
      act("logout","SIGN OUT","btn-outline")+'</div>' :
    '<div class="card online-signup"><span class="pill pill-purple">FREE DAILY GAME</span>'+
    '<h3>Get on the leaderboard.</h3><p class="small muted">Enter your email and we’ll send a secure sign-in link. No password needed.</p>'+
    '<form data-form="login"><label class="answer-label" for="online-email">EMAIL ADDRESS</label>'+
    '<div class="answer-row"><input class="answer-input" id="online-email" type="email" required autocomplete="email" placeholder="you@example.com">'+
    '<button class="btn btn-primary" type="submit">SEND LINK</button></div></form>'+
    (state.sent ? notice("Check your email for your sign-in link.","ok") : "")+'</div>';
  const inviteBanner=state.pendingInvite?
    '<div class="card invited-banner"><span class="eyebrow">YOU HAVE BEEN INVITED</span>'+
    '<h3>Your friends are waiting in OUTLIER.</h3>'+
    '<p class="small muted">Join a private league to compare verified daily scores. A link never joins you automatically.</p>'+
    (signedIn?act("join-invite","JOIN FRIENDS LEAGUE →","btn-teal")+
      act("dismiss-invite","NOT NOW","btn-ghost"):
      '<p class="small muted">Sign in below to accept your league invitation.</p>')+
    '</div>':"";
  setView(heading + inviteBanner + (state.error ? notice(state.error,"warning") : "")+
    (state.message ? notice(state.message,"ok") : "")+
    (!rankedReady?notice("Online beta setup is incomplete: verified ranked games are not open yet. The guest daily game is still free.","warning"):"")+
    buttons + profilePanel() + onlineJourney() + myReviewsPanel() + leaguesPanel() + boardUI());
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
  state.rejected=null;
  const q=state.game.question;
  const isFit=q.type==="fit";
  const options=isFit ?
    '<div class="fit-options">'+(q.choices||[]).map((choice,index)=>
      '<button class="fit-option" data-online="pick" data-answer="'+escape(choice)+'"><span>'+escape(choice)+'</span><span>'+
      String.fromCharCode(65+index)+'</span></button>').join("")+'</div>' :
    '<form data-form="answer"><label class="answer-label" for="online-answer">YOUR MOST UNEXPECTED CORRECT ANSWER</label>'+
    '<div class="answer-row"><input class="answer-input" maxlength="100" id="online-answer" required autocomplete="off" aria-describedby="online-answer-validation" placeholder="Type your answer...">'+
    '<button type="submit" class="btn btn-primary">LOCK IT IN →</button></div>'+
    '<p id="online-answer-validation" class="answer-validation" role="alert" aria-live="assertive" hidden></p>'+
    '<p class="retry-hint">Not recognized? Keep guessing — the clock stays running.</p>'+
    '</form><div id="online-retry-report"></div>';
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
  const rarity=!isFit && f.valid ? rarityTier(f.points) : null;
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
    escape(f.accepted||"No accepted answer")+'</p>'+
    (rarity?'<span class="rarity-pill">✦ '+escape(rarity.label)+' · EDITORIAL TIER</span>':'')+
    '<span class="pill pill-yellow">TOTAL '+number(state.game.score)+' PTS</span></div>'+
    '<div class="feedback-divider"></div><h3>'+(isFit?"Crowd response board":"Some of the highest-scoring answers")+
    '</h3>'+examples+
    (state.feedback?.history?.available && !isFit ?
      '<div class="observed-rarity"><span class="eyebrow">REAL HISTORICAL RESPONSES</span>'+
      '<p class="small muted">From '+number(state.feedback.history.sampleSize)+
      ' completed games on earlier days. These counts describe players, not your score.</p>'+
      (state.feedback.history.answers||[]).slice(0,6).map(row=>
        '<div><strong>'+escape(row.name)+'</strong><span>'+row.percent+'% · '+number(row.picks)+' picks</span></div>'
      ).join("")+'</div>' : '')+
    (!isFit && !f.valid && f.response ?
      '<form class="online-review" data-form="review"><label for="review-reason">THINK '+escape(f.response)+
      ' SHOULD COUNT? EXPLAIN WHY</label><textarea id="review-reason" required minlength="12" maxlength="500" rows="3" placeholder="Include an explanation and a reliable source..."></textarea>'+
      '<button class="btn btn-ghost" type="submit">REQUEST ANSWER REVIEW</button></form>' : '')+
    '<p class="insight">Prototype rarity points are fixed editorial tiers. Historical response counts (when available) are observational and do not change today’s score.</p>'+
    act("next",state.game.complete?"SEE FINAL RESULTS →":"NEXT QUESTION →",isFit?"btn-teal btn-wide feedback-next":"btn-primary btn-wide feedback-next")+
    '</div>');
}

function onlineDebriefPanel(answers) {
  const d=dailyDebrief([],answers);
  return '<section class="card v13-debrief">'+
    '<div class="eyebrow">AFTER THE BUZZER / OFFICIAL RECAP</div>'+
    '<h2>YOUR DAILY DEBRIEF.</h2>'+
    '<p class="small muted">'+d.accepted+' of '+d.rounds+' accepted responses. Editorial scores are not crowd surveys.</p>'+
    '<div class="v13-debrief-cards">'+
    '<div><small>✦ DEEPEST CUT</small><strong>'+escape(d.bestRare?.accepted||"No approved pick")+'</strong>'+
      '<span>'+number(d.bestRare?.points||0)+' editorial points</span></div>'+
    '<div><small>◎ STRONGEST CROWD CALL</small><strong>'+escape(d.bestFit?.accepted||"No prediction")+'</strong>'+
      '<span>'+number(d.bestFit?.points||0)+' points</span></div>'+
    '<div><small>↗ NEXT CHALLENGE</small><strong>'+d.missed.length+' rounds missed</strong>'+
      '<span>Try another unranked session to practice your knowledge.</span></div></div>'+
    '<details class="v13-category-ledger"><summary>EXPLORE YOUR CATEGORY LEDGER</summary>'+
    d.categories.map(c=>'<div class="v13-category-row"><span>'+escape(c.name)+'</span><b>'+
      number(c.points)+' / '+number(c.rounds*1000)+'</b></div>').join("")+'</details></section>';
}
function crowdPulsePanel(answers) {
  if(state.game?.mode!=="daily")return "";
  const picks=answers.filter(a=>a.type==="fit" && a.questionId);
  if(!picks.length)return "";
  const rows=picks.map(a=>{
    const pulse=state.crowdPulses?.[a.questionId];
    const response=pulse?.available?
      '<div class="v13-pulse-board">'+pulse.answers.slice(0,6).map(item=>
        '<div class="v13-category-row"><span>'+escape(item.name)+'</span>'+
        '<strong>'+number(item.picks)+' picks · '+number(item.percent)+'%</strong></div>').join("")+'</div>':
      '<p class="small muted">'+(pulse?"Not enough opted-in prior-day responses yet (30 required).":
        "Checking opted-in historical responses…")+'</p>';
    return '<article class="v13-pulse-item"><h4>'+escape(a.category||"FIT IN")+
      ' · '+escape(a.accepted||"No pick")+'</h4>'+
      (pulse?.available?'<small>OBSERVED OPT-IN SAMPLE · '+number(pulse.sampleSize)+' PRIOR-DAY PICKS</small>':'')+
      response+'</article>';
  }).join("");
  return '<section class="card v13-crowd-pulse"><div class="eyebrow">◎ WHAT THE OPTED-IN CROWD PICKED</div>'+
    '<h2>THE REAL CROWD PULSE.</h2>'+
    '<p class="small muted">Only previous completed verified dailies after explicit opt-in. '+
    'Samples below 30 are hidden. Observations never change today’s frozen score.</p>'+
    rows+'</section>';
}
function loadCrowdPulses() {
  const g=state.game;
  if(g?.mode!=="daily"||!g.complete||state.crowdLoadingFor===g.id||state.crowdLoadedFor===g.id)return;
  const ids=[...new Set((g.answers||[]).filter(a=>a.type==="fit"&&a.questionId).map(a=>a.questionId))];
  if(!ids.length)return;
  state.crowdLoadingFor=g.id;
  Promise.all(ids.map(async id=>{
    try {
      const response=await invoke("crowd-pulse",{query:"question="+encodeURIComponent(id)});
      return [id,response.pulse];
    } catch {return [id,{available:false,reason:"unavailable"}];}
  })).then(results=>{
    if(state.game?.id!==g.id)return;
    state.crowdPulses=Object.fromEntries(results);
    state.crowdLoadedFor=g.id;
    if(state.view==="results")showResults();
  }).finally(()=>{if(state.crowdLoadingFor===g.id)state.crowdLoadingFor=null;});
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
    onlineDebriefPanel(answers)+crowdPulsePanel(answers)+
    '<div class="card result-breakdown"><h3>Round by round</h3>'+rows+'</div>'+
    '<p class="small muted text-center" style="margin-top:20px">'+
    (g.mode==="daily"?"One official attempt per UTC day. Practice never counts toward the public leaderboards.":
     "This practice result does not affect your lifetime rankings.")+'</p>');
  loadCrowdPulses();
}
function showRetryWarning(message="That answer isn't in our accepted library. Try another answer before time runs out!") {
  const warning=container.querySelector("#online-answer-validation");
  const field=container.querySelector("#online-answer");
  if(warning){ warning.textContent=message; warning.hidden=false; }
  if(field){field.value="";field.setAttribute("aria-invalid","true");field.focus({preventScroll:true});}
  const report=container.querySelector("#online-retry-report");
  if(report && state.rejected?.guess && state.game?.question?.type==="rare"){
    report.innerHTML='<div class="retry-report">'+
      '<span>Think this answer should count? You can request a review without giving up the round.</span>'+
      '<form data-form="review"><label for="review-reason">WHY SHOULD “'+escape(state.rejected.guess)+'” COUNT?</label>'+
      '<textarea id="review-reason" minlength="12" maxlength="500" required rows="2" '+
      'placeholder="Include a reliable reference..."></textarea>'+
      '<button type="submit" class="btn btn-ghost">REQUEST REVIEW ↗</button></form></div>';
  }
}
async function submitAnswer(response) {
  if (busy || state.view!=="game" || !state.game) return;
  busy=true;
  try {
    const result=await invoke("answer", {method:"POST",payload:{
      game:state.game.id,index:state.game.index,response
    }});
    state.game=result.state;
    if(result.retry){
      state.rejected={guess:String(response||""),questionId:state.game.question?.id};
      showRetryWarning();
      return;
    }
    state.rejected=null;
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
  if (action==="crowd-consent") {
    busy=true;
    try {
      const enabled=button.dataset.enabled==="true";
      await invoke("crowd-consent",{method:"POST",payload:{enabled}});
      await reloadProfile();
      state.message=enabled?"Your opt-in applies to future completed official guesses.":
        "Consent withdrawn. Your previous guesses are excluded from future aggregates.";
      state.error=null;showMenu();
    }catch(e){showError(e,"Could not change crowd consent")}
    finally{busy=false;}
    return;
  }
  if (action==="dismiss-invite") {
    state.pendingInvite=null;
    window.history.replaceState(null,"",removeLeagueInvite(window.location.href));
    showMenu();
  }
  if (action==="join-invite") {
    if(!state.user||!state.pendingInvite)return;
    busy=true;
    try {
      await invoke("league-join",{method:"POST",payload:{code:state.pendingInvite}});
      state.pendingInvite=null;
      window.history.replaceState(null,"",removeLeagueInvite(window.location.href));
      await reloadLeagues();
      state.message="You're in! Your friends' league is now listed below.";
      showMenu();
    }catch(e){showError(e,"Could not join the league")}
    finally{busy=false;}
  }
  if(action==="rivalry") {
    state.rivalId=button.dataset.user;
    state.rivalry=null;
    showBusy("Comparing verified daily scores...");
    try{await reloadRivalry();showRivalry();}
    catch(e){showError(e,"Rivalry not available")}
  }
  if(action==="rivalry-back") {
    state.rivalry=null;state.rivalId=null;
    showLeague();
  }
  if(action==="rivalry-refresh") {
    showBusy("Refreshing your duel...");
    try{await reloadRivalry();showRivalry();}
    catch(e){showError(e,"Could not refresh duel")}
  }
  if(action==="rivalry-invite") {
    const link=leagueInviteLink(window.location.href,state.activeLeague.code);
    const message="OUTLIER — Let's play the same seven daily questions and compare our verified scores!\n"+link;
    try{await navigator.clipboard.writeText(message);state.message="Spoiler-free rivalry invite copied.";}
    catch{state.message="Copy unavailable. Share the league link: "+link;}
    showRivalry();
  }
  if (action==="league-view") {
    state.activeLeague=(state.leagues||[]).find(l=>l.id===button.dataset.id)||null;
    state.leaguePeriod="week";
    if(!state.activeLeague) return;
    showBusy("Loading your league...");
    try {await reloadLeagueStandings();showLeague();}catch(e){showError(e);}
  }
  if (action==="league-period") {
    state.leaguePeriod=button.dataset.period||"week";
    showBusy("Loading friends' standings...");
    try {await reloadLeagueStandings();showLeague();}catch(e){showError(e);}
  }
  if (action==="league-copy") {
    const code=button.dataset.code || state.activeLeague?.code;
    if(code){
      const link=leagueInviteLink(window.location.href,code);
      try {
        await navigator.clipboard.writeText(link);
        state.message="Invite link copied! Friends choose whether to join.";
      }catch {
        state.message="Copy unavailable. Share this league code: "+code;
      }
      if(state.view==="league")showLeague();else showMenu();
    }
  }
  if (action==="board") {
    state.board=button.dataset.board;
    showBusy("Loading rankings...");
    try {await reloadBoard(); showMenu();}catch(e){showError(e);}
  }
  if (action==="daily") await start("daily");
  if (action==="practice") await start("practice");
  if (action==="checkout") await checkout();
  if (action==="restore") {
    busy=true;
    try{
      const result=await invoke("purchase-status");
      await reloadProfile();
      state.message=result.unlimited
        ?"Your lifetime access is confirmed on this account. Unlimited practice is unlocked."
        :result.refundedAt
          ?"Lifetime access is not active: the recorded purchase was refunded or disputed."
          :"No confirmed lifetime unlock is attached to this account. A return from Stripe alone doesn't activate access.";
      state.error=null;showMenu();
    }catch(e){showError(e,"Purchase status unavailable")}
    finally{busy=false;}
  }
  if (action==="menu") {state.rejected=null;await Promise.all([reloadBoard(),reloadProfile(),reloadLeagues(),reloadCapabilities()]).catch(()=>{});showMenu();}
  if (action==="next") await advance();
  if (action==="pick") await submitAnswer(button.dataset.answer);
  if (action==="skip") await submitAnswer(null);
  if (action==="share") {
    const text=officialShareMessage({
      day:state.game.day,score:state.game.score,mode:state.game.mode,
      name:state.profile?.name||""
    })+"\n"+window.location.origin+window.location.pathname;
    try {await navigator.clipboard.writeText(text);state.message="Score copied!";}catch{state.message="Could not copy in this browser.";}
    showResults();
  }
  if (action==="logout") {
    await supabase.auth.signOut();
    state.user=null;state.profile=null;state.game=null;state.crowdPulses={};state.crowdLoadedFor=null;
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
      const redirect=new URL(window.location.origin+window.location.pathname);
      redirect.searchParams.set("online","1");
      if(state.pendingInvite)redirect.searchParams.set("league",state.pendingInvite);
      const redirectTo=redirect.href;
      const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo}});
      if (error) throw error;
      state.sent=true;state.error=null;showMenu();
    } catch(e) {showError(e,"Sign-in link failed");}
    finally {busy=false;}
  }
  if (form.dataset.form==="league-create" || form.dataset.form==="league-join") {
    busy=true;
    try {
      const create=form.dataset.form==="league-create";
      const payload=create ? {title:container.querySelector("#league-name")?.value} :
        {code:container.querySelector("#league-code")?.value};
      await invoke(create?"league-create":"league-join",{method:"POST",payload});
      await reloadLeagues();
      state.message=create?"Your new league is ready. Share its invite code!":"You joined the league.";
      state.error=null;showMenu();
    }catch(e){showError(e,"Could not update league");}
    finally{busy=false;}
    return;
  }
  if (form.dataset.form==="review") {
    busy=true;
    const retrying=state.view==="game";
    try {
      const id=retrying?state.rejected?.questionId:state.feedback?.feedback?.questionId;
      if(!id||!state.game?.id)throw new Error("No eligible answer for review");
      await invoke("review",{method:"POST",payload:{
        game:state.game.id,questionId:id,
        reason:container.querySelector("#review-reason")?.value
      }});
      state.message="Answer review submitted. You can keep guessing; your score is unchanged.";
      if(retrying) {
        const report=container.querySelector("#online-retry-report");
        if(report) report.innerHTML='<p class="answer-review-ok" role="status">Review submitted! Keep guessing while time remains.</p>';
      } else {
        if(state.feedback?.feedback)state.feedback.feedback.response=null;
        showFeedback();
      }
    } catch(e) {
      if(retrying) showRetryWarning("Review couldn't be submitted: "+e.message+". Keep guessing!");
      else { state.message="Review not submitted: "+e.message;showFeedback(); }
    } finally{busy=false;}
    return;
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
  state={view:"loading",board:"daily",players:[],user:null,profile:null,capabilities:null,game:null,feedback:null,rejected:null,
    leagues:[],activeLeague:null,leaguePlayers:[],leaguePeriod:"week",rivalId:null,rivalry:null,
    crowdPulses:{},crowdLoadingFor:null,crowdLoadedFor:null,
    pendingInvite:readLeagueInvite(window.location.search),
    error:null,message:null,sent:false};
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
  container.oninput=event=>{
    if(event.target?.id==="online-answer") {
      const warning=container.querySelector("#online-answer-validation");
      if(warning) warning.hidden=true;
      event.target.removeAttribute("aria-invalid");
    }
  };
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
    if (state.user) await Promise.all([reloadProfile(),reloadLeagues()]);
    await Promise.all([reloadBoard(),reloadCapabilities()]);
    const params=new URLSearchParams(window.location.search);
    if (params.get("checkout")==="success") {
      state.message="Checkout returned. Payment status is not proof of a purchase. Select CHECK / RESTORE LIFETIME ACCESS to verify the signed webhook.";
    } else if(params.get("checkout")==="cancel") {
      state.message="Checkout canceled. No payment was recorded.";
    }
    if(params.has("checkout")){
      params.delete("checkout");
      window.history.replaceState(null,"",
        window.location.pathname+(params.toString()?"?"+params:"")+window.location.hash);
    }
    showMenu();
  } catch (e) {state.error="Connection is unavailable. Check the hosted API setup. "+(e?.message||"");showMenu();}
}
