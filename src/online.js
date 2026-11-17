import {rarityTier} from "./answer-intelligence.js";
import {normalizedGuestNickname,isTemporaryGuest,guestAuthMessage} from "./guest-party.js";
import {ROOM_THEMES,ROOM_TIMERS,ROOM_SERIES,privateGameHighlights,
  privateScoreShareText,earnedPrivateBadges} from "./game-night-insights.js";
import {readLeagueInvite,leagueInviteLink,removeLeagueInvite,officialShareMessage,comparisonLabel} from "./community.js";
import { ONLINE_ENABLED, SUPABASE_URL, SUPABASE_ANON_KEY } from "./online-config.js";
import { dailyDebrief, weeklyCup } from "./v13-discovery.js";
import {privateTitle,privateSeasonLeaders,cleanRivalryTimeline} from "./party-competition.js";
import {readRoomInvite,roomInviteUrl,roomSecondsRemaining,roomWinnerRows,
  ROOM_RECOVERY_KEY,roomRecoveryRecord,readRoomRecovery,retryDelayMs,roomConnectivityError,roomRoundStages} from "./online-room.js";

const escape = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const number = value => Number(value ?? 0).toLocaleString("en-US");
let container, onBack, supabase, state, timer, busy = false;
let authSubscription=null;
let guestEntering=false;
let partyPolling=null,partyTicker=null,partyRefreshing=false;
function saveRoomRecovery() {
  if(!state?.user?.id||!state.partyId)return;
  try{localStorage.setItem(ROOM_RECOVERY_KEY,JSON.stringify(
    roomRecoveryRecord(state.user.id,state.partyId)));}catch{}
}
function clearRoomRecovery() {
  try{localStorage.removeItem(ROOM_RECOVERY_KEY);}catch{}
}
function loadRoomRecovery(userId) {
  try{
    const raw=JSON.parse(localStorage.getItem(ROOM_RECOVERY_KEY)||"null");
    const roomId=readRoomRecovery(raw,userId);
    if(!roomId&&raw)clearRoomRecovery();
    return roomId;
  }catch{return null;}
}
function stopPartyPolling() {
  if(partyPolling)clearInterval(partyPolling);
  if(partyTicker)clearInterval(partyTicker);
  partyPolling=null;partyTicker=null;partyRefreshing=false;
}

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
  catch(error){ state.capabilities={rankedReady:false,paymentReady:false,partyReady:false};
    state.message="The competitive server has not been verified as ready yet."; }
}
async function reloadProfile() {
  if (!state.user) return;
  const result = await invoke("profile");
  state.profile = result;
}
async function reloadLeagues() {
  if(!state.user||isTemporaryGuest(state.user)){state.leagues=[];return;}
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
  if (!state.profile||isTemporaryGuest(state.user)) return "";
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


function partyCompetitionPanel() {
  if(isTemporaryGuest(state.user))return "";
  // Completed member-only history must remain visible when an independent
  // exhibition catalog is temporarily offline or awaiting new content.
  if(!state.user)return "";
  const rows=Array.isArray(state.partyHistory)?state.partyHistory.slice(0,8):[];
  const season=privateSeasonLeaders(state.partySeason);
  const lifetime=Array.isArray(state.partyLifetime)?state.partyLifetime:[];
  const period=state.partyPeriod||"month";
  const filters=[["week","THIS WEEK"],["month","THIS MONTH"],["all","LAST 150"]];
  const tabs=filters.map(([key,label])=>
    act("party-period",label,"btn-outline"+(period===key?" active":""),
      'data-period="'+key+'" aria-pressed="'+(period===key)+'"')).join("");
  const rivalry=state.partyRivalry;
  const recent=cleanRivalryTimeline(rivalry?.recent);
  const mastery=state.partyMastery;
  const earned=mastery?earnedPrivateBadges(mastery):[];
  const masteryPanel=mastery?'<section class="party-mastery" aria-label="Private game-night achievements">'+
    '<div class="eyebrow">YOUR VERIFIED GAME-NIGHT CAREER</div>'+
    '<div class="party-career-stats">'+
      [['MATCHES',mastery.games],['WINS',mastery.wins],
       ['PERSONAL BEST',mastery.bestScore],['DEEP CUTS',mastery.rareHits]]
      .map(([name,value])=>'<div><small>'+escape(name)+'</small><strong>'+
        number(value)+'</strong></div>').join("")+'</div>'+
    '<div class="party-badges">'+earned.map(b=>
      '<div class="party-badge '+(b.unlocked?'is-unlocked':'is-locked')+
      '" title="'+escape(b.description)+'"><span>'+(b.unlocked?'★':'◇')+'</span>'+
      '<strong>'+escape(b.name)+'</strong><small>'+escape(b.description)+
      '</small></div>').join("")+'</div>'+
    '<p class="small muted">These milestones use only your completed, server-verified private matches. Guest games and official daily scores are separate.</p></section>':'';
  return '<section class="card private-season" aria-label="Verified private match history">'+
    '<div class="eyebrow">FRIENDS-ONLY / VERIFIED ROOM RESULTS</div>'+
    '<h3>THE INNER CIRCLE RECORD BOOK.</h3>'+masteryPanel+
    '<p class="small muted">Only rooms you actually joined count. Opponents, scores and wins are verified by the server. No answer keys, guest games, public global ranks or money involved. Long-range results use at most 150 recent matches.</p>'+
    '<div class="party-season-periods" role="group" aria-label="Match period">'+tabs+'</div>'+
    '<div class="private-season-standings"><div class="private-season-row heading">'+
      '<span>PLAYER</span><span>W</span><span>T</span><span>L</span><span>POINTS</span></div>'+
      (season.length?season.slice(0,20).map((p,i)=>
        '<div class="private-season-row"><span>'+
          (p.id===state.user.id?'<strong>YOU</strong>':act("party-rival",escape(p.name),"btn-ghost",
            'data-opponent="'+escape(p.id)+'" aria-label="Your verified rivalry with '+escape(p.name)+'"'))+
          (p.seasonLeader?'<small class="season-top-tag">★ PERIOD LEADER</small>':'')+
          '<small class="season-title">'+escape(privateTitle(lifetime.find(x=>x.id===p.id)?.wins||0).name)+'</small>'+
          '</span><strong>'+number(p.wins)+'</strong><span>'+number(p.ties)+'</span>'+
          '<span>'+number(p.losses)+'</span><strong>'+number(p.points)+'</strong></div>').join(""):
      '<p class="small muted">No finished private games in this period yet.</p>')+'</div>'+
    (rivalry?'<div class="party-rivalry-verified" role="status"><strong>YOUR ROOM RIVALRY</strong>'+
      '<p>'+number(rivalry.wins)+' WINS · '+number(rivalry.ties)+' TIES · '+
      number(rivalry.losses)+' LOSSES · '+number(rivalry.shared)+' SHARED MATCHES</p>'+
      (recent.length?'<h5>RECENT VERIFIED HEAD-TO-HEAD MATCHES</h5>'+
        recent.map(item=>'<div class="party-rivalry-day"><span>'+
          escape(new Date(item.startedAt).toLocaleDateString("en-US"))+'</span><b>'+
          number(item.you)+' — '+number(item.them)+'</b><strong>'+
          escape(item.outcome.toUpperCase())+'</strong></div>').join(""):'')+'</div>':'')+
    '<h4>MATCH JOURNAL</h4>'+
    (rows.length?rows.map(row=>
      '<div class="private-history-row"><span>'+escape(new Date(row.startedAt).toLocaleDateString("en-US"))+
      ' · '+number(row.players)+' PLAYERS</span><b class="private-history-outcome">'+
      escape(String(row.outcome||"").toUpperCase())+'</b><strong>'+
      number(row.yourScore)+' PTS</strong></div>').join(""):
      '<p class="small muted">Your verified private championships will appear here after the shared seven-round timer finishes.</p>')+
    '<p class="small muted">These records are scoped to your authenticated room memberships; changing devices requires the same signed-in account.</p>'+
    '</section>';
}
async function reloadPartyCompetition() {
  if(!state.user||isTemporaryGuest(state.user))return;
  const [history,season,allTime,mastery]=await Promise.all([
    invoke("party-history"),
    invoke("party-season",{query:"period="+encodeURIComponent(state.partyPeriod||"month")}),
    invoke("party-season",{query:"period=all"}),
    invoke("party-mastery").catch(()=>({mastery:null}))
  ]);
  state.partyHistory=Array.isArray(history.history)?history.history:[];
  state.partySeason=Array.isArray(season.standings)?season.standings:[];
  state.partyLifetime=Array.isArray(allTime.standings)?allTime.standings:[];
  state.partyMastery=mastery.mastery&&typeof mastery.mastery==="object"?mastery.mastery:null;
}
function partyRoomPanel() {
  if(state.capabilities?.partyReady!==true)return '<div class="card online-party-panel">'+
    '<div class="eyebrow">PRIVATE ROOM COMPETITION · NOT ACTIVATED</div>'+
    '<h3>FRIEND MATCHES ARE TEMPORARILY UNAVAILABLE.</h3>'+
    '<p class="small muted">The separately reviewed exhibition question bank and protected multiplayer API must be ready. The free daily and local Pass & Play still work.</p></div>';
  if(!state.user)return '<section class="card online-party-panel guest-room-entry">'+
    '<div class="eyebrow">FRIENDS · NO ACCOUNT NEEDED</div>'+
    '<h3>'+(state.pendingRoomCode?'YOUR FRIEND IS WAITING.':'YOUR GAME NIGHT STARTS HERE.')+'</h3>'+
    '<p class="small muted">Pick a nickname. No email, password or sign-up. The server keeps every answer and timer synchronized. Invites never join you automatically.</p>'+
    '<form data-form="guest-party" class="guest-room-form">'+
      '<label for="guest-room-nickname">YOUR NICKNAME</label>'+
      '<input class="answer-input" id="guest-room-nickname" name="nickname" maxlength="24" minlength="2" autocomplete="nickname" required placeholder="e.g. Brian">'+
      '<label for="guest-room-code">FRIEND INVITE CODE (OPTIONAL)</label>'+
      '<input class="answer-input" id="guest-room-code" name="code" maxlength="12" minlength="12" pattern="[A-Fa-f0-9]{12}" placeholder="12-character invite code" value="'+escape(state.pendingRoomCode||"")+'">'+
      '<div class="guest-room-actions">'+
        '<button class="btn btn-primary" type="submit" value="join" name="guest-intent">JOIN FRIEND ↗</button>'+
        '<button class="btn btn-teal" type="submit" value="create" name="guest-intent">CREATE PRIVATE ROOM ↗</button>'+
      '</div></form>'+
    '<p class="tiny muted">Your temporary identity stays on this browser while its session exists. You can add a verified account afterward to preserve your history.</p></section>';
  return '<section class="card online-party-panel"><div class="eyebrow">NEW / PRIVATE SHOWDOWN</div>'+
    '<h3>FRIENDS. SEPARATE SCREENS. SAME CLOCK.</h3>'+
    '<p class="small muted">2–4 players with server-verified room sessions answer seven shared questions. Choose the timer and championship length in the lobby. No email required for guests. Scores stay sealed until the final reveal.</p>'+
    (state.partyId?act("party-reopen","REJOIN MY PRIVATE ROOM ↗","btn-teal"):'')+
    act("party-create","CREATE A PRIVATE ROOM ↗","btn-primary")+
    '<form data-form="party-join"><label class="answer-label" for="online-party-code">INVITE CODE</label>'+
      '<div class="answer-row"><input id="online-party-code" class="answer-input" minlength="12" maxlength="12" pattern="[A-Fa-f0-9]{12}" required placeholder="12-character invite code">'+
      '<button class="btn btn-outline" type="submit">JOIN</button></div></form></section>';
}
function partyClockText(seconds) {
  const s=Math.max(0,Math.ceil(seconds));
  return Math.floor(s/60)+':'+String(s%60).padStart(2,"0");
}
function tickPartyClock() {
  if(state.view!=="party-room"||!state.partyRoom)return;
  const r=state.partyRoom;
  const end=r.phase==="countdown"?r.startedAt:r.question?.deadline;
  if(!end)return;
  const left=roomSecondsRemaining(end,r.serverTime,state.partyReceivedAt);
  const label=container.querySelector("#online-party-timer");
  if(label)label.textContent=partyClockText(left);
}
async function refreshPartyRoom(force=false) {
  if(!state.partyId||partyRefreshing)return;
  partyRefreshing=true;
  try{
    const response=await invoke("party-state",{query:"room="+encodeURIComponent(state.partyId)});
    const room=response.room;
    const signature=JSON.stringify([room.phase,room.players?.map(p=>[p.id,p.ready,p.active]),
      room.question?.index,room.question?.submitted,room.scores?.length,
      room.rematch?.votes,room.rematch?.roomId,room.startedAt,
      room.roundSeconds,room.targetPlayers,room.seriesLength,room.seriesGame,room.selectedTheme,
      room.myTheme,room.themeVotes,room.series?.played]);
    const offlineWas=state.partyOffline;
    state.partyRoom=room;state.partyReceivedAt=Date.now();
    state.partyOffline=false;state.partyFailureCount=0;state.partyError=null;
    saveRoomRecovery();
    if(room.phase==="finished"&&state.partySignature&&!state.partySignature.includes("finished"))
      state.partyRevealStep=-1;
    if(force||offlineWas||signature!==state.partySignature||state.view!=="party-room"){
      state.partySignature=signature;showPartyRoom();
    }
    tickPartyClock();
  }catch(e){
    if(!roomConnectivityError(e)){
      stopPartyPolling();clearRoomRecovery();
      state.partyId=null;state.partyRoom=null;
      showError(e,"This private room is unavailable or you are not a member");
    }else{
      state.partyOffline=true;
      state.partyError="Connection interrupted. Your server-owned room and answers remain saved. Reconnecting automatically.";
      state.partyFailureCount=(state.partyFailureCount||0)+1;
      state.partyLastFailureAt=Date.now();
      if(state.partyRoom)showPartyRoom();
      else{
        state.view="party-room";
        setView('<div class="card online-party-offline" role="status"><h2>ROOM CONNECTION INTERRUPTED.</h2>'+
          '<p class="muted">Your membership is kept on the server. OUTLIER will retry; the shared clock keeps running.</p>'+
          act("party-refresh","TRY AGAIN","btn-primary")+
          act("party-leave","BACK TO ONLINE HUB","btn-outline")+'</div>');
      }
    }
  }finally{partyRefreshing=false;}
}
function beginPartyPolling() {
  stopPartyPolling();
  partyPolling=setInterval(()=>{
    if(busy||document.hidden||!state?.partyId)return;
    if(state.partyOffline&&Date.now()-state.partyLastFailureAt<
        retryDelayMs(state.partyFailureCount))return;
    void refreshPartyRoom();
  },3000);
  partyTicker=setInterval(tickPartyClock,200);
}
async function enterPartyRoom(id) {
  state.partyId=id;state.partyRoom=null;state.partySignature=null;
  state.partyOffline=false;state.partyFailureCount=0;state.partyLastFailureAt=0;
  state.partyRevealStep=-1;
  saveRoomRecovery();
  await refreshPartyRoom(true);
  if(state.partyId)beginPartyPolling();
}
function showPartyRoom() {
  stopTimer();
  const r=state.partyRoom;if(!r)return showMenu();
  state.view="party-room";
  const offlineBanner=state.partyOffline?
    notice(state.partyError||"Reconnecting… Your room is still saved.","warning"):"";
  const header='<div class="online-party-head"><span class="eyebrow">OUTLIER · SERVER-VERIFIED PRIVATE SHOWDOWN</span>'+
    '<h2>THE INNER CIRCLE.</h2>'+
    '<p>Same seven questions for everyone. Your account is verified; individual scores stay sealed until the clock closes.</p></div>';
  const people=(r.players||[]).map((m,i)=>'<div class="online-party-member"><span class="party-portrait portrait-'+(i%8)+'">'+
    escape(String(m.name||"P").slice(0,1).toUpperCase())+'</span>'+
    '<strong>'+escape(m.name||"Player")+'</strong>'+
    (m.id===r.host?'<small>HOST</small>':'')+
    (m.id===state.user?.id?'<small>YOU</small>':'')+
    '<small class="party-presence '+(m.active?'is-online':'is-away')+'">'+
      (m.active?'● ACTIVE':'◌ LAST SEEN >15S')+'</small>'+
    (r.phase==="waiting"?'<span class="party-ready-tag '+(m.ready?'is-ready':'')+'">'+
      (m.ready?'READY':'NOT READY')+'</span>':'')+
    '</div>').join("");
  const roster='<div class="online-party-roster">'+people+'</div>';
  const rules='<div class="party-rule-banner" role="status">'+
    '<span>'+number(r.roundSeconds||45)+' SEC / ROUND</span>'+ 
    '<span>'+number(r.targetPlayers||2)+' PLAYERS TO START</span>'+
    '<span>GAME '+number(r.seriesGame||1)+' OF '+number(r.seriesLength||1)+'</span>'+
    '<span>THEME '+escape(r.selectedTheme||"MIXED")+'</span></div>';
  let body='';
  if(r.phase==="waiting"){
    const me=(r.players||[]).find(p=>p.id===state.user?.id);
    const readyCount=(r.players||[]).filter(p=>p.ready).length;
    const allReady=(r.players||[]).length===Number(r.targetPlayers||2)&&readyCount===r.players.length;
    const votes=Array.isArray(r.themeVotes)?r.themeVotes:[];
    const themePanel='<section class="party-theme-panel" aria-label="Vote for a topic">'+
      '<h4>VOTE FOR THE SHOWDOWN THEME</h4>'+
      '<p class="small muted">Your vote influences the Stand Out question draw. Ties are resolved consistently by the server. Voting resets readiness for a fair new start.</p>'+
      '<div class="party-theme-grid">'+ROOM_THEMES.map(theme=>{
        const count=votes.find(v=>v.theme===theme)?.votes||0;
        const mine=r.myTheme===theme;
        return act("party-theme",escape(theme)+" · "+number(count),
          mine?"btn-teal":"btn-outline",
          'data-theme="'+theme+'" aria-pressed="'+mine+'"');
      }).join("")+'</div></section>';
    const configPanel=r.host===state.user?.id?
      '<form data-form="party-config" class="party-settings-form">'+
      '<h4>HOST GAME SETTINGS</h4>'+
      '<label for="party-timer-setting">SECONDS PER QUESTION</label>'+
      '<select class="answer-input" id="party-timer-setting">'+
        ROOM_TIMERS.map(n=>'<option value="'+n+'" '+
          (Number(r.roundSeconds||45)===n?'selected':'')+'>'+n+' SECONDS</option>').join("")+
      '</select><label for="party-series-setting">GAMES IN CHAMPIONSHIP</label>'+
      '<select class="answer-input" id="party-series-setting">'+
        ROOM_SERIES.map(n=>'<option value="'+n+'" '+
          (Number(r.seriesLength||1)===n?'selected':'')+'>'+n+
          (n===1?' GAME':' GAMES')+'</option>').join("")+'</select>'+
      '<button class="btn btn-outline" type="submit">SAVE GAME RULES</button>'+
      '<p class="tiny muted">Changing the rules clears all ready confirmations. Every player must agree again.</p></form>':'';
    const capacityPanel=r.host===state.user?.id?
      '<form data-form="party-target" class="party-settings-form">'+
      '<h4>ROOM CAPACITY</h4><label for="party-player-setting">PLAYERS REQUIRED</label>'+
      '<select class="answer-input" id="party-player-setting">'+
      [2,3,4].map(n=>'<option value="'+n+'" '+
        (Number(r.targetPlayers||2)===n?'selected':'')+'>'+n+' PLAYERS</option>').join('')+
      '</select><button class="btn btn-outline" type="submit">SAVE PLAYER COUNT</button>'+
      '<p class="tiny muted">You cannot reduce capacity below the number already in the room. Any change clears READY confirmations.</p></form>':'';
    body='<div class="card online-party-waiting"><div class="eyebrow">LOBBY · '+(r.players||[]).length+'/'+number(r.targetPlayers||2)+' PLAYERS</div>'+rules+
      '<h3>BRING THE CREW.</h3><p class="small muted">Share your invite. Every player must explicitly mark READY. The host starts only when the chosen 2–4-player room is full and everyone agrees. Presence is based on a recent server ping, not a permanent connection.</p>'+
      '<div class="party-invite-code">'+escape(r.code||"")+'</div>'+
      '<div class="party-invite-actions">'+
      act("party-copy","COPY INVITE LINK","btn-primary")+
      act("party-share","SHARE INVITE ↗","btn-teal")+'</div>'+roster+capacityPanel+configPanel+themePanel+
      '<p class="party-ready-counter" role="status">'+readyCount+' OF '+r.players.length+' READY</p>'+
      act("party-ready",me?.ready?'I AM NOT READY':'I AM READY ✓',
        me?.ready?'btn-outline':'btn-primary',
        'data-ready="'+(!me?.ready)+'" aria-pressed="'+Boolean(me?.ready)+'"')+
      (r.host===state.user?.id?
        act("party-start","START SEVEN-ROUND MATCH ↗","btn-teal",allReady?'':'disabled') :
        '<p class="small muted">The host starts when every player is ready.</p>')+
      act("party-exit-lobby",r.host===state.user?.id?'CLOSE ROOM FOR EVERYONE':'LEAVE THIS LOBBY',"btn-ghost")+
      '</div>';
  }else if(r.phase==="countdown"){
    body='<div class="card online-party-countdown">'+rules+'<span class="eyebrow">EVERYONE GET READY</span>'+
      '<h3>THE CLOCK STARTS IN</h3><div class="online-party-bigclock" id="online-party-timer">—</div>'+
      roster+'<p class="small muted">The timer is synchronized to the server, not your device clock.</p></div>';
  }else if(r.phase==="playing"){
    const q=r.question||{};
    const stages=roomRoundStages(Number(q.index));
    const progress='<div class="party-round-track" role="group" aria-label="Seven-round match progress">'+
      stages.map(step=>'<span class="party-round-step is-'+step.status+'" '+
        (step.status==="current"?'aria-current="step" ':'')+
        'aria-label="Round '+step.number+', '+step.status+'">'+step.number+'</span>').join("")+
      '</div>';
    body='<div class="card online-party-question">'+rules+'<div class="eyebrow">SHARED ROUND '+(Number(q.index)+1)+' / 7'+
      ' · '+escape(q.category)+'</div><div class="online-party-clock" id="online-party-timer">—</div>'+
      progress+'<h3>'+escape(q.prompt||"Waiting for the shared question…")+'</h3>'+
      '<p class="small muted">'+escape(q.detail||"")+'</p>'+
      (q.submitted?'<div class="online-party-sealed">🔒 ANSWER LOCKED. Keep your pick secret until all seven shared rounds finish.</div>':
        q.type==="fit"?'<div class="online-party-picks">'+(q.choices||[]).map(choice=>
          '<button class="btn btn-outline" type="button" data-online="party-pick" data-answer="'+escape(choice)+'">'+escape(choice)+'</button>').join("")+'</div>'+
          act("party-skip","LOCK BLANK ANSWER","btn-ghost"):
          '<form data-form="party-answer"><label for="online-party-answer">YOUR UNEXPECTED CORRECT ANSWER</label>'+
            '<div class="answer-row"><input id="online-party-answer" class="answer-input" maxlength="100" required placeholder="Enter an approved answer">'+
            '<button type="submit" class="btn btn-primary">LOCK IT IN ↗</button></div></form>'+
            act("party-skip","LOCK BLANK ANSWER","btn-ghost"))+
      roster+'<p class="small muted">One submission per question. A wrong answer earns zero; later corrections are not permitted. All choices are sealed and no ranked progress is awarded.</p></div>';
  }else if(r.phase==="finished"){
    const n=state.partyRevealStep;
    if(n<0){
      body='<section class="card online-party-finale"><div class="eyebrow">ALL SEVEN SHARED ROUNDS ARE CLOSED</div>'+
        '<div class="party-reveal-symbol" aria-hidden="true">✹</div>'+
        '<h3>THE REVEAL IS YOURS.</h3><p>Everyone finished under the same clock. Uncover each answer before the final standings.</p>'+
        act("party-reveal-next","REVEAL ROUND ONE ↗")+'</section>';
    }else if(n<7){
      const q=(r.questions||[])[n]||{};
      const picks=(r.players||[]).map((player,i)=>{
        const pick=(r.answers||[]).find(a=>a.index===n&&a.player===player.id);
        return '<div class="party-pick-card"><span class="party-pick-player"><span class="party-portrait portrait-'+(i%8)+'">'+
          escape(String(player.name||"P").slice(0,1).toUpperCase())+'</span>'+
          escape(player.name||"Player")+'</span><strong>'+escape(pick?.accepted||"No accepted answer")+'</strong>'+
          '<span class="party-pick-score">'+number(pick?.points||0)+' PTS</span></div>';
      }).join("");
      body='<section class="online-party-final-reveal"><div class="eyebrow">THE REVEAL · ROUND '+(n+1)+' OF 7</div>'+
        '<h3>'+escape(q.prompt||"THE SHARED QUESTION")+'</h3><div class="party-picks-grid">'+picks+'</div>'+
        act("party-reveal-next",n===6?"SHOW FINAL STANDINGS ↗":"REVEAL NEXT ROUND ↗")+'</section>';
    }else{
      const scores=roomWinnerRows(r.scores);
      const champion=scores.filter(p=>p.winner).map(p=>p.name).join(" & ");
      const rematch=r.rematch||{};
      const insights=privateGameHighlights(r);
      const rare=insights?.highest;
      const highlightPanel=insights?'<div class="party-highlights">'+
        '<div class="eyebrow">GAME NIGHT HIGHLIGHTS</div>'+
        '<div class="party-highlights-grid">'+
        '<div><small>BIGGEST VALID PICK</small><strong>'+
          (rare?escape(rare.answer):'NONE')+'</strong><span>'+number(rare?.points||0)+' PTS</span></div>'+
        '<div><small>LEAD CHANGES</small><strong>'+number(insights.leadChanges)+
          '</strong><span>AFTER FULL ROUNDS</span></div>'+
        '<div><small>FINISH</small><strong>'+
          (insights.comeback?'COMEBACK':insights.closeFinish?'PHOTO FINISH':'DECISIVE')+
          '</strong><span>'+number(insights.margin??0)+'-POINT MARGIN</span></div></div>'+
        '<h4>ROUND-BY-ROUND SCORE BUILD</h4><div class="party-score-timeline">'+
          insights.rounds.map(round=>'<div><span>R'+round.number+'</span>'+
            round.scores.map(p=>'<small>'+escape(p.name)+': <b>'+number(p.total)+
              '</b></small>').join("")+'</div>').join("")+'</div></div>':'';
      const series=r.series&&typeof r.series==='object'?r.series:null;
      const seriesPanel=series?'<section class="party-series-results">'+
        '<h4>THE CHAMPIONSHIP · '+number(series.played)+' / '+
          number(series.length)+' FINISHED</h4>'+
        '<p class="small muted">Win count leads; total verified points break ties. Players must unanimously agree to each new game.</p>'+
        (Array.isArray(series.standings)?series.standings.map((p,i)=>
          '<div><span>'+number(i+1)+'. '+escape(p.name)+'</span>'+
          '<strong>'+number(p.wins)+' W · '+number(p.points)+' PTS</strong></div>').join(""):'')+
        (series.complete?'<strong class="party-champion-label">CHAMPIONSHIP COMPLETE</strong>':'')+
        '</section>':'';
      body='<section class="card online-party-final-scores"><div class="party-winner-mark">🏆</div>'+
        '<div class="eyebrow">THE VERIFIED SHOWDOWN RESULT</div><h3>'+escape(champion)+' '+(scores.filter(p=>p.winner).length>1?"TIE!":"WINS!")+'</h3>'+
        scores.map(p=>'<div class="online-party-score '+(p.winner?'winner':'')+'"><strong>'+
          escape(p.name)+'</strong><span>'+number(p.score)+' / 7,000 PTS</span></div>').join("")+
        '<p class="small muted">Server-verified exhibition points appear in your private friend history and season, never official daily rankings or paid progression.</p>'+
        highlightPanel+seriesPanel+
        act("party-share-score","COPY NAME-FREE SCORECARD ↗","btn-outline")+
        (rematch.seriesComplete?'':'<div class="party-rematch-vote"><h4>RUN IT BACK TOGETHER?</h4>'+
          '<p>'+number(rematch.votes||0)+' / '+number(rematch.needed||r.players.length)+' voted. A fresh room opens only when everyone agrees, with a new ready-up step.</p>'+
          (rematch.roomId?act("party-rematch-join","JOIN AGREED REMATCH ↗","btn-teal") :
            rematch.voted?'<p class="small muted">Your vote is recorded. Waiting for the others.</p>':
              act("party-rematch-vote","VOTE FOR NEXT GAME ↗","btn-primary"))+'</div>')+
        act("party-leave","BACK TO ONLINE HUB","btn-outline")+'</section>';
    }
  }else{
    body='<div class="card">'+notice("This private room expired. Create a new room.","warning")+
      act("party-leave","BACK TO ONLINE HUB","btn-primary")+'</div>';
  }
  const roomFeedback=state.message?notice(state.message,"ok"):"";
  state.message=null;
  setView(header+offlineBanner+roomFeedback+body+'<div class="online-party-room-actions">'+
    act("party-refresh","REFRESH ROOM","btn-outline")+
    act("party-leave","LEAVE ROOM VIEW","btn-outline")+'</div>');
  tickPartyClock();
}
function showMenu() {
  stopTimer();stopPartyPolling();
  state.view="menu";
  const guest=isTemporaryGuest(state.user);
  const registered=Boolean(state.user)&&!guest;
  const hasIdentity=Boolean(state.user);
  const heading='<div class="online-heading"><span class="eyebrow">OUTLIER · GAME NIGHT</span>'+
    '<h1>PLAY WITH <span class="gradient-text">YOUR FRIENDS.</span></h1>'+
    '<p class="muted">Private rooms are free. Enter a nickname and play immediately, or use a verified account to keep your long-term competitive record. The free guest daily game never requires an account.</p></div>';
  const rankedReady=state.capabilities?.rankedReady===true;
  const paymentReady=state.capabilities?.paymentReady===true;
  const isTestCheckout=state.capabilities?.paymentMode==="test";
  const buttons=registered?
    '<div class="online-menu-actions">'+
      (rankedReady?act("daily","PLAY MY OFFICIAL DAILY →"):
        '<p class="small muted">Verified daily competition is awaiting its private question bank. The free guest game still works.</p>')+
      (state.profile?.unlimited&&rankedReady?act("practice","UNLIMITED PRACTICE ↻","btn-teal"):
        !state.profile?.unlimited&&paymentReady&&rankedReady?
          act("checkout",isTestCheckout?"TRY TEST CHECKOUT · NO CHARGE":"UNLOCK PRACTICE · $4.99 ONCE","btn-ghost"):'')+
      act("restore","CHECK / RESTORE LIFETIME ACCESS","btn-outline")+
      act("logout","SIGN OUT","btn-outline")+'</div>':
    guest?'<section class="card guest-identity-card"><span class="eyebrow">PLAYING AS A GUEST</span>'+
      '<h3>'+escape(state.profile?.name||"Guest player")+'</h3>'+
      '<p class="small muted">No email required. Your guest session works on this browser until you sign out or clear browser storage. It cannot be recovered automatically from another device.</p>'+
      '<form data-form="name" class="online-name-form"><label for="online-display">CHANGE NICKNAME</label>'+
      '<div class="answer-row"><input class="answer-input" id="online-display" name="name" minlength="2" maxlength="24" required value="'+escape(state.profile?.name||"Guest")+'">'+
      '<button class="btn btn-outline" type="submit">UPDATE NAME</button></div></form>'+
      '<div class="guest-upgrade"><h4>WANT TO KEEP YOUR HISTORY?</h4>'+
      '<p class="small muted">Optional: link a verified email to this temporary profile. Do not sign out while confirming it. Existing accounts need a separate migration to merge records.</p>'+
      '<form data-form="guest-upgrade"><label for="guest-upgrade-email">EMAIL (OPTIONAL)</label>'+
      '<div class="answer-row"><input class="answer-input" id="guest-upgrade-email" type="email" required autocomplete="email" placeholder="you@example.com">'+
      '<button class="btn btn-teal" type="submit">SAVE MY PROFILE</button></div></form></div>'+
      act("guest-exit","END GUEST SESSION","btn-ghost")+'</section>':
    '<section class="card online-signup"><span class="pill pill-purple">OPTIONAL VERIFIED ACCOUNT</span>'+
    '<h3>Want persistent stats?</h3><p class="small muted">Email sign-in is only needed for permanent accounts, ranked competitions, and friend leagues. Private game nights work without it.</p>'+
    '<form data-form="login"><label class="answer-label" for="online-email">EMAIL ADDRESS</label>'+
    '<div class="answer-row"><input class="answer-input" id="online-email" type="email" required autocomplete="email" placeholder="you@example.com">'+
    '<button class="btn btn-outline" type="submit">SEND SIGN-IN LINK</button></div></form>'+
    (state.sent?notice("Check your email for your sign-in link.","ok"):"")+'</section>';
  const partyInvite=state.pendingRoomCode?'<div class="card online-party-invite">'+
    '<span class="eyebrow">PRIVATE ROOM INVITATION</span>'+
    '<h3>YOUR FRIEND SENT A CHALLENGE.</h3>'+
    '<p class="small muted">Open the room with a nickname. You join only after choosing to accept; an invite link alone never enrolls anyone.</p>'+
    (hasIdentity&&state.capabilities?.partyReady===true?
      act("party-accept-invite","ACCEPT INVITE ↗","btn-primary"):
      '<p class="small muted">Enter a nickname in the game-night panel below to join without an account.</p>')+
    act("party-dismiss-invite","IGNORE INVITE","btn-outline")+'</div>':"";
  const inviteBanner=state.pendingInvite?
    '<div class="card invited-banner"><span class="eyebrow">FRIEND LEAGUE INVITATION</span>'+
    '<h3>Compete on verified daily results.</h3>'+
    '<p class="small muted">A permanent account is required for friend leagues. An invite never joins you automatically.</p>'+
    (registered?act("join-invite","JOIN FRIENDS LEAGUE →","btn-teal")+
      act("dismiss-invite","NOT NOW","btn-ghost"):
      '<p class="small muted">Use optional email sign-in to join this league.</p>')+'</div>':"";
  setView(heading+partyInvite+inviteBanner+
    (state.error?notice(state.error,"warning"):"")+
    (state.message?notice(state.message,"ok"):"")+
    (!rankedReady&&registered?notice("Official ranked daily competition is not activated yet. Free guest daily play is still available.","warning"):"")+
    partyRoomPanel()+buttons+
    (registered?partyCompetitionPanel()+profilePanel()+onlineJourney()+myReviewsPanel()+leaguesPanel():"")+
    boardUI());
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
async function submitPartyAnswer(answer) {
  const q=state.partyRoom?.question;
  if(!state.partyId||state.partyRoom?.phase!=="playing"||q?.submitted||busy||state.partyOffline)return;
  busy=true;
  try{
    await invoke("party-answer",{method:"POST",payload:{
      room:state.partyId,index:q.index,response:answer
    }});
    await refreshPartyRoom(true);
  }catch(e){
    state.message=e.message;
    await refreshPartyRoom(true);
  }finally{busy=false;}
}
// A guest is a valid temporary Auth identity with a server-verified JWT,
 // not an unsecured nickname header. No anonymous account is minted until
 // somebody explicitly requests CREATE or JOIN with valid input.
async function ensureGuestRoomIdentity(nickname) {
  const clean=normalizedGuestNickname(nickname);
  if(state.user){
    if(isTemporaryGuest(state.user) && state.profile?.name!==clean){
      const result=await invoke("profile",{method:"PATCH",payload:{name:clean}});
      state.profile={...(state.profile||{}),name:result.name};
    }
    return state.user;
  }
  guestEntering=true;
  try{
    const {data,error}=await supabase.auth.signInAnonymously();
    if(error)throw new Error(guestAuthMessage(error));
    if(!data?.user||!isTemporaryGuest(data.user))
      throw new Error("The temporary guest identity was not verified. Try again.");
    state.user=data.user;
    const result=await invoke("profile",{method:"PATCH",payload:{name:clean}});
    state.profile={name:result.name,stats:{}};
    state.error=null;
    return data.user;
  }finally{guestEntering=false;}
}
async function handleClick(event) {
  const button=event.target.closest("[data-online]");
  if (!button || !container.contains(button)) return;
  const action=button.dataset.online;
  if (action==="back") {stopTimer();stopPartyPolling();authSubscription?.unsubscribe();authSubscription=null;container.onclick=null;container.onsubmit=null;window.removeEventListener("keydown",onKeydown);onBack();return;}
  if (busy) return;
  if(action==="guest-exit"){
    if(!isTemporaryGuest(state.user))return;
    if(!window.confirm("End this guest session? You will lose access to its private history unless you linked and verified an account. You can keep playing without signing out."))return;
    busy=true;
    try{
      stopPartyPolling();clearRoomRecovery();
      const {error}=await supabase.auth.signOut();
      if(error)throw error;
      state.message="Guest session ended. You can start again with a nickname.";
      state.user=null;state.profile=null;state.partyId=null;state.partyRoom=null;
      showMenu();
    }catch(error){state.message=error.message;showMenu();}
    finally{busy=false;}
    return;
  }
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
  if(action==="party-dismiss-invite"){
    state.pendingRoomCode=null;
    const u=new URL(window.location.href);u.searchParams.delete("room");
    window.history.replaceState(null,"",u.pathname+u.search+u.hash);
    showMenu();return;
  }
  if(action==="party-reopen"){
    if(state.partyId)await enterPartyRoom(state.partyId);
    return;
  }
  if(action==="party-accept-invite"){
    if(!state.user||!state.pendingRoomCode)return;
    busy=true;
    try{
      const joined=await invoke("party-join",{method:"POST",
        payload:{code:state.pendingRoomCode}});
      state.pendingRoomCode=null;
      const u=new URL(window.location.href);u.searchParams.delete("room");
      window.history.replaceState(null,"",u.pathname+u.search+u.hash);
      await enterPartyRoom(joined.room.id);
    }catch(e){showError(e,"Could not accept private room invite");}
    finally{busy=false;}
    return;
  }
  if(action==="party-create"){
    if(!state.user)return;
    busy=true;
    try{
      const response=await invoke("party-create",{method:"POST",payload:{}});
      await enterPartyRoom(response.room.id);
    }catch(e){showError(e,"Could not create private room")}
    finally{busy=false;}
    return;
  }
  if(action==="party-ready"){
    if(!state.partyId||state.partyRoom?.phase!=="waiting")return;
    busy=true;
    try{
      await invoke("party-ready",{method:"POST",
        payload:{room:state.partyId,ready:button.dataset.ready==="true"}});
      await refreshPartyRoom(true);
    }catch(e){state.partyError=e.message;state.message=e.message;showPartyRoom();}
    finally{busy=false;}
    return;
  }
  if(action==="party-exit-lobby"){
    if(!state.partyId||state.partyRoom?.phase!=="waiting")return;
    const host=state.partyRoom.host===state.user?.id;
    if(!window.confirm(host?"Close this waiting room for everyone?":"Leave this waiting room?"))return;
    busy=true;
    try{
      await invoke("party-leave",{method:"POST",payload:{room:state.partyId}});
      clearRoomRecovery();stopPartyPolling();
      state.partyId=null;state.partyRoom=null;
      state.message=host?"The waiting room was closed.":"You left the waiting room.";
      showMenu();
    }catch(e){state.message=e.message;showPartyRoom();}
    finally{busy=false;}
    return;
  }
  if(action==="party-rematch-vote"){
    if(!state.partyId||state.partyRoom?.phase!=="finished"||
       state.partyRevealStep<7)return;
    busy=true;
    try{
      const response=await invoke("party-rematch",{method:"POST",payload:{room:state.partyId}});
      if(response.vote?.roomId)await enterPartyRoom(response.vote.roomId);
      else await refreshPartyRoom(true);
    }catch(e){state.message=e.message;showPartyRoom();}
    finally{busy=false;}
    return;
  }
  if(action==="party-rematch-join"){
    const next=state.partyRoom?.rematch?.roomId;
    if(next)await enterPartyRoom(next);
    return;
  }
  if(action==="party-period"){
    const p=button.dataset.period;
    if(!["week","month","all"].includes(p))return;
    state.partyPeriod=p;state.partyRivalry=null;
    try{
      const result=await invoke("party-season",{query:"period="+encodeURIComponent(p)});
      state.partySeason=Array.isArray(result.standings)?result.standings:[];
      showMenu();
    }catch(e){state.message=e.message;showMenu();}
    return;
  }
  if(action==="party-rival"){
    const opponent=button.dataset.opponent;
    if(!opponent||opponent===state.user?.id)return;
    try{
      const result=await invoke("party-rivalry",{query:"opponent="+encodeURIComponent(opponent)});
      state.partyRivalry=result.rivalry;
      showMenu();
    }catch(e){state.message=e.message;showMenu();}
    return;
  }
  if(action==="party-theme"){
    if(!state.partyId||state.partyRoom?.phase!=="waiting")return;
    busy=true;
    try{
      await invoke("party-theme",{method:"POST",
        payload:{room:state.partyId,theme:button.dataset.theme}});
      state.message="Theme vote recorded. Everyone must confirm READY again.";
      await refreshPartyRoom(true);
    }catch(e){state.message=e.message;showPartyRoom();}
    finally{busy=false;}
    return;
  }
  if(action==="party-share-score"){
    const shared=privateScoreShareText(state.partyRoom);
    if(!shared)return;
    try{await navigator.clipboard.writeText(shared);
      state.message="Name-free scorecard copied. No invite codes or answers included.";
    }catch{state.message="Copy isn't available in this browser.";}
    showPartyRoom();return;
  }
  if(action==="party-start"){
    if(!state.partyId||state.partyRoom?.host!==state.user?.id)return;
    busy=true;
    try{
      await invoke("party-start",{method:"POST",payload:{room:state.partyId}});
      await refreshPartyRoom(true);
    }catch(e){state.message=e.message;showPartyRoom();}
    finally{busy=false;}
    return;
  }
  if(action==="party-refresh"){
    await refreshPartyRoom(true);return;
  }
  if(action==="party-leave"){
    stopPartyPolling();
    await reloadPartyCompetition().catch(()=>{});
    state.partyRevealStep=-1;showMenu();return;
  }
  if(action==="party-copy"||action==="party-share"){
    if(!state.partyRoom?.code)return;
    const link=roomInviteUrl(window.location.href,state.partyRoom.code);
    if(action==="party-share"&&typeof navigator.share==="function"){
      try{
        await navigator.share({
          title:"OUTLIER — private game night",
          text:"Join my seven-round OUTLIER trivia showdown!",
          url:link
        });
        state.message="Invite shared. Your friend can choose whether to join.";
      }catch(error){
        if(error?.name==="AbortError")return;
        try{
          await navigator.clipboard.writeText(link);
          state.message="Native sharing failed; the invite link was copied instead.";
        }catch{
          state.message="Share unavailable. Copy this invite URL manually: "+link;
        }
      }
    }else{
      try{
        await navigator.clipboard.writeText(link);
        state.message="Private room invite link copied.";
      }catch{
        state.message="Copy unavailable. Share this invite URL manually: "+link;
      }
    }
    showPartyRoom();return;
  }
  if(action==="party-pick"||action==="party-skip"){
    await submitPartyAnswer(action==="party-skip"?null:button.dataset.answer);return;
  }
  if(action==="party-reveal-next"){
    if(state.partyRoom?.phase!=="finished")return;
    state.partyRevealStep=Math.min(7,state.partyRevealStep+1);
    showPartyRoom();return;
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
  if (action==="menu") {
    state.rejected=null;
    await Promise.all([reloadBoard(),reloadProfile(),reloadLeagues(),reloadCapabilities()]).catch(()=>{});
    await reloadPartyCompetition().catch(()=>{});
    showMenu();
  }
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
    stopPartyPolling();clearRoomRecovery();await supabase.auth.signOut();
    state.user=null;state.profile=null;state.game=null;state.crowdPulses={};state.crowdLoadedFor=null;
    showMenu();
  }
}
async function handleSubmit(event) {
  const form=event.target.closest("[data-form]");
  if (!form) return;
  event.preventDefault();
  if (busy) return;
  if(form.dataset.form==="guest-party"){
    if(state.user)return;
    // Validate nickname AND the intended room code before creating the
    // temporary Supabase user. A bare invite link never creates a session.
    let nickname,code;
    const intent=event.submitter?.value==="create"?"create":"join";
    try{
      nickname=normalizedGuestNickname(form.querySelector("#guest-room-nickname")?.value);
      code=String(form.querySelector("#guest-room-code")?.value||"").trim().toLowerCase();
      if(intent==="join"&&!/^[a-f0-9]{12}$/.test(code))
        throw new Error("Paste the 12-character invite code to join, or choose CREATE PRIVATE ROOM.");
    }catch(error){
      state.error=error.message;showMenu();return;
    }
    busy=true;
    showBusy(intent==="join"?"Joining your friend's room…":"Preparing your game night…");
    try{
      await ensureGuestRoomIdentity(nickname);
      const response=intent==="join"?
        await invoke("party-join",{method:"POST",payload:{code}}):
        await invoke("party-create",{method:"POST",payload:{}});
      state.pendingRoomCode=null;
      if(intent==="join"){
        const link=new URL(window.location.href);
        link.searchParams.delete("room");
        window.history.replaceState(null,"",link.pathname+link.search+link.hash);
      }
      await enterPartyRoom(response.room.id);
    }catch(error){
      state.error=guestAuthMessage(error);showMenu();
    }finally{busy=false;}
    return;
  }
  if(form.dataset.form==="guest-upgrade"){
    if(!isTemporaryGuest(state.user))return;
    const email=String(form.querySelector("#guest-upgrade-email")?.value||"").trim();
    if(!email)return;
    busy=true;
    try{
      const {error}=await supabase.auth.updateUser({email});
      if(error)throw error;
      state.message="Check your email and follow the verification link to keep this profile. Do not sign out before the link is confirmed.";
      state.error=null;
    }catch(error){
      state.error="Could not link the email: "+error.message+
        ". The owner may need to enable identity linking in Supabase Auth. Your current guest session is still intact.";
    }finally{busy=false;showMenu();}
    return;
  }
  if (form.dataset.form==="answer") return submitAnswer(container.querySelector("#online-answer")?.value?.trim()||null);
  if (form.dataset.form==="party-answer")
    return submitPartyAnswer(container.querySelector("#online-party-answer")?.value?.trim()||null);
  if(form.dataset.form==="party-target"){
    if(!state.partyId||state.partyRoom?.phase!=="waiting"||
      state.partyRoom?.host!==state.user?.id)return;
    const target=Number(container.querySelector("#party-player-setting")?.value);
    if(![2,3,4].includes(target))return;
    busy=true;
    try{
      await invoke("party-target",{method:"POST",payload:{room:state.partyId,target}});
      state.message="Player count saved. Everyone must mark READY again.";
      await refreshPartyRoom(true);
    }catch(e){state.message=e.message;showPartyRoom();}
    finally{busy=false;}
    return;
  }
  if(form.dataset.form==="party-config"){
    if(!state.partyId||state.partyRoom?.phase!=="waiting"||
      state.partyRoom?.host!==state.user?.id)return;
    const seconds=Number(container.querySelector("#party-timer-setting")?.value);
    const seriesLength=Number(container.querySelector("#party-series-setting")?.value);
    if(!ROOM_TIMERS.includes(seconds)||!ROOM_SERIES.includes(seriesLength))return;
    busy=true;
    try{
      await invoke("party-config",{method:"POST",
        payload:{room:state.partyId,seconds,seriesLength}});
      state.message="Rules saved. Everyone must mark READY again.";
      await refreshPartyRoom(true);
    }catch(e){state.message=e.message;showPartyRoom();}
    finally{busy=false;}
    return;
  }
  if (form.dataset.form==="party-join") {
    busy=true;
    try{
      const code=container.querySelector("#online-party-code")?.value?.trim();
      const response=await invoke("party-join",{method:"POST",payload:{code}});
      await enterPartyRoom(response.room.id);
    }catch(e){showError(e,"Could not join private room")}
    finally{busy=false;}
    return;
  }
  if (form.dataset.form==="login") {
    const email=String(container.querySelector("#online-email")?.value||"").trim();
    if (!email) return;
    busy=true;
    try {
      const redirect=new URL(window.location.origin+window.location.pathname);
      redirect.searchParams.set("online","1");
      if(state.pendingInvite)redirect.searchParams.set("league",state.pendingInvite);
      if(state.pendingRoomCode)redirect.searchParams.set("room",state.pendingRoomCode);
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
    pendingRoomCode:readRoomInvite(window.location.search),partyId:null,partyRoom:null,
    partyReceivedAt:0,partySignature:null,partyRevealStep:-1,
    partyOffline:false,partyFailureCount:0,partyLastFailureAt:0,partyError:null,
    partyHistory:[],partySeason:[],partyLifetime:[],partyPeriod:"month",partyRivalry:null,
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
    // getSession() may read locally cached tokens. getUser() verifies them
    // with Supabase Auth before displaying any account-specific experience.
    const {data,error}=await supabase.auth.getUser();
    if(error&&error.name!=="AuthSessionMissingError"&&
       !/auth session missing/i.test(error.message||""))throw error;
    state.user=data?.user??null;
    // This is UX defense in depth. Server-side Edge routes independently
    // verify every user token; hiding controls is never our authorization.
    authSubscription?.unsubscribe();
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==="SIGNED_OUT"){
        stopTimer();stopPartyPolling();clearRoomRecovery();
        state.user=null;state.profile=null;state.game=null;state.partyId=null;
        state.partyRoom=null;state.partyHistory=[];state.partySeason=[];
        state.partyLifetime=[];state.partyRivalry=null;state.leagues=[];
        state.activeLeague=null;state.error=null;
        if(container.isConnected)showMenu();
      } else if(event==="SIGNED_IN"&&session?.user&&!state.user){
        if(guestEntering){state.user=session.user;return;}
        // Defer network work outside the auth-state callback to avoid
        // blocking the auth client's internal session processing.
        state.user=session.user;
        Promise.resolve().then(async()=>{
          await Promise.all([reloadProfile(),reloadLeagues(),reloadCapabilities()]);
          await reloadPartyCompetition().catch(()=>{});
          if(container.isConnected)showMenu();
        }).catch(error=>{state.error=error.message;showMenu();});
      }
      if(event==="USER_UPDATED"&&session?.user){
        state.user=session.user;
        if(state.view==="menu"){
          Promise.resolve().then(()=>reloadProfile()).then(()=>showMenu()).catch(()=>showMenu());
        }
      }
    });
    authSubscription=subscription;
    if (state.user) await Promise.all([reloadProfile(),reloadLeagues()]);
    await Promise.all([reloadBoard(),reloadCapabilities()]);
    if(state.user)await reloadPartyCompetition().catch(error=>{
      console.warn("Private competition records unavailable:",error?.message);
    });
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
    if(state.user){
      const previous=loadRoomRecovery(state.user.id);
      if(previous){
        await enterPartyRoom(previous);
        if(state.partyId&&state.view==="party-room")return;
      }
    }
    showMenu();
  } catch (e) {state.error="Connection is unavailable. Check the hosted API setup. "+(e?.message||"");showMenu();}
}
