import { scoreExplanation } from "./rarity-insights.js";
import { describeRareMoment } from "./rare-moments.js";
import {PLAYER_TITLES,PLAYER_FRAMES,identityProgress,atlasProfile,weeklyMissions} from "./player-atlas.js";
import { buildRound, buildLegacyRound, utcDay, normalizeAnswer, evaluate, scoreOf, getTier, lifetimeStats, shareText, shuffled, randomFromSeed, seedFromString, inspectRareGuess, practiceCategoryOptions, buildArcadeRound, arcadeFormats, arcadeMaximum, QUESTION_SECONDS, MAX_SCORE } from "./game.js";
import { rareQuestions, fitQuestions } from "./data.js";
import { activityWeek, currentStreak, longestStreak, earnedBadges } from "./progression.js";
import { ONLINE_ENABLED } from "./online-config.js";
import {THEMES,TOUR_STEPS,completedDailyCount,unlockableThemes,weeklySeason,seasonArchive,betaChecklistState,safeFeedbackUrl} from "./beta.js";
import {scoreHistory,weekSummary,nextGoal,versusHistory,utcResetRemaining} from "./journey.js";
import { readFriendChallenge, challengeLink, challengeOutcome, categoryInsights } from "./social.js";
import {dailyDebrief,weeklySpotlight,weeklySpotlightRound} from "./v13-discovery.js";

const STORAGE_KEY = "outlier-prototype-v1";
const app = document.getElementById("app");
const toastNode = document.getElementById("toast");
const modalRoot = document.getElementById("modal-root");

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { days: raw.days && typeof raw.days === "object" ? raw.days : {},
      arcade: raw.arcade && typeof raw.arcade === "object" ? raw.arcade : {},
      sound: Boolean(raw.sound),
      beta: raw.beta && typeof raw.beta === "object" ? raw.beta : {},
      theme: typeof raw.theme === "string" ? raw.theme : "nebula",
      player: raw.player && typeof raw.player==="object"
        ? {title:String(raw.player.title||""),frame:String(raw.player.frame||"")}
        : {title:"",frame:""} };
  } catch {
    return { days: {}, arcade: {}, sound: false, beta: {}, theme: "nebula",
      player:{title:"",frame:""} };
  }
}
const storage = loadStore();
let screen = "home";
let session = null;
let feedback = null;
let boardTab = "daily";
let practiceFormat = "classic";
let tourPage = 0;
let tourWasSeenThisSession = false;
const friendChallenge = readFriendChallenge(window.location.search, utcDay());
let intervalId = null;
let toastTimeout = null;
let soundContext = null;

function saveStore() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(storage)); }
  catch { /* Private mode or disabled storage: gameplay still works this session. */ }
}
function saveDaily() {
  if (!session || session.mode !== "daily") return;
  storage.days[session.day] = {
    answers: session.answers,
    questionIds: session.questions.map(question => question.id),
    complete: session.answers.length === 7,
    deadline: session.deadline,
    startedAt: storage.days[session.day]?.startedAt || Date.now()
  };
  saveStore();
}
function fmt(number) { return Number(number || 0).toLocaleString("en-US"); }
function esc(input) {
  return String(input ?? "").replace(/[&<>"']/g, char =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[char]);
}
function today() { return utcDay(); }
function friendlyDay(day) {
  return new Date(day + "T12:00:00Z").toLocaleDateString("en-US", { timeZone:"UTC", month:"long", day:"numeric", year:"numeric" });
}
function homeButton(label, action, style = "btn-primary") {
  return '<button type="button" class="btn ' + style + '" data-action="' + action + '">' + label + '</button>';
}

function renderWeekBars() {
  const days = activityWeek(storage.days, today());
  return '<div class="week-bars" aria-label="Completed official games over the past seven UTC days">' +
    days.map(item => {
      const dayName = new Date(item.day + "T12:00:00Z").toLocaleDateString("en-US", { weekday:"short", timeZone:"UTC" }).slice(0,1);
      return '<div class="week-day" title="' + esc(item.day) + ': ' + (item.complete ? fmt(item.score) + ' points' : 'not completed') + '">' +
        '<div class="week-block ' + (item.complete ? 'played' : 'unplayed') + (item.day === today() ? ' is-today' : '') + '">' +
        (item.complete ? '✦' : '·') + '</div><span>' + dayName + '</span></div>';
    }).join("") + '</div>';
}
function progressPanel() {
  const streak = currentStreak(storage.days, today());
  const badges = earnedBadges(storage.days);
  const earned = badges.filter(b=>b.earned);
  const next = badges.find(b=>!b.earned);
  return '<section class="progress-zone"><div class="card progress-card">' +
    '<div class="progress-top"><div><div class="eyebrow">THE LONG GAME</div><h3>Make every day count.</h3>' +
    '<p class="muted small">Build your record with one official game a day. Practice never changes it.</p></div>' +
    '<div class="streak-pill"><span class="streak-flame">🔥</span><b>' + streak + '</b><small>DAY STREAK</small></div></div>' +
    renderWeekBars() +
    '<div class="progress-bottom"><div><span class="small muted">BADGES EARNED</span><div class="progress-badge-line">' +
    (earned.length ? earned.slice(-4).map(b=>'<span class="mini-badge" title="' + esc(b.title) + '">' + esc(b.icon) + '</span>').join("") :
      '<span class="small muted">Your first badge is one daily game away.</span>') +
    '</div></div><div class="next-badge">' + (next ? '<small>UP NEXT</small><b>' + esc(next.icon) + ' ' + esc(next.title) + '</b>' :
      '<small>COLLECTION</small><b>All badges unlocked!</b>') + '</div>' +
    '<button class="btn btn-outline" data-action="leaderboard" type="button">MY PROGRESS →</button></div></div></section>';
}

function renderKnowledgeProfile() {
  const categories = categoryInsights(storage.days).slice(0,6);
  if (!categories.length) return '<div class="card knowledge-card"><div class="eyebrow">KNOWLEDGE DNA</div>'+
    '<h3>Find your strongest topics.</h3><p class="muted small">Complete an official daily game to start building your category profile.</p></div>';
  return '<div class="card knowledge-card"><div class="eyebrow">YOUR KNOWLEDGE DNA</div>' +
    '<h3>Where your brain shines.</h3><p class="small muted">Average points per question in each category you have played.</p>' +
    '<div class="knowledge-list">' + categories.map(cat =>
      '<div class="knowledge-row"><div class="knowledge-row-label"><span>' + esc(cat.name) + ' <small>(' + cat.attempts + ')</small></span><b>' + fmt(cat.average) + ' / 1,000</b></div>' +
      '<div class="bar-bg"><div class="bar-fg" style="width:' + (cat.average/10) + '%"></div></div></div>'
    ).join("")+'</div><p class="tiny muted">These are your own records, not comparisons with other players.</p></div>';
}


function playerCardPreview() {
  const identity=identityProgress(storage.days,storage.player);
  return '<div class="card identity-preview"><div class="identity-preview-art frame-'+esc(identity.frame.id)+'">'+
    '<span aria-hidden="true">'+esc(identity.frame.icon)+'</span>'+
    '<strong>'+esc(identity.title.icon)+'</strong></div>'+
    '<div><span class="eyebrow">YOUR PLAYER IDENTITY</span><h3>'+esc(identity.title.name)+'</h3>'+
    '<p class="muted small">'+identity.daysPlayed+' completed official days · '+fmt(identity.xp)+' cosmetic XP</p></div>'+
    homeButton('CUSTOMIZE →','leaderboard','btn-outline')+'</div>';
}
function playerIdentityPanel() {
  const identity=identityProgress(storage.days,storage.player);
  return '<section class="card player-identity-panel"><div class="section-heading">'+
    '<div><span class="eyebrow">THE PLAYER YOU ARE BECOMING</span><h3>Wear your knowledge.</h3>'+
    '<p class="small muted">Titles and frames unlock through official daily games. They never affect points or rankings.</p></div>'+
    '<div class="player-badge frame-'+esc(identity.frame.id)+'" aria-label="Current player frame: '+esc(identity.frame.name)+'">'+
    '<span>'+esc(identity.frame.icon)+'</span><strong>'+esc(identity.title.icon)+'</strong></div></div>'+
    '<div class="player-identity-metrics"><span>'+fmt(identity.xp)+' <small>COSMETIC XP</small></span>'+
      '<span>'+identity.daysPlayed+' <small>OFFICIAL DAYS</small></span>'+
      '<span>'+identity.bestRare+' <small>BEST RARE PICK</small></span></div>'+
    '<div class="eyebrow">PLAYER TITLES</div><div class="identity-choices">'+
    identity.titles.map(t=>'<button type="button" data-action="player-title" data-id="'+esc(t.id)+'" '+
      'class="identity-choice '+(identity.title.id===t.id?'active':'')+'" '+
      (t.unlocked?'':'disabled')+' aria-pressed="'+(identity.title.id===t.id)+'">'+
      '<b>'+esc(t.icon)+' '+esc(t.name)+'</b><small>'+
        (t.unlocked?'UNLOCKED':t.remaining+' MORE DAILY GAMES')+'</small></button>').join('')+
    '</div><div class="eyebrow" style="margin-top:20px">COLLECTIBLE FRAMES</div>'+
    '<div class="identity-choices">'+identity.frames.map(f=>'<button type="button" '+
      'data-action="player-frame" data-id="'+esc(f.id)+'" class="identity-choice '+(identity.frame.id===f.id?'active':'')+'" '+
      (f.unlocked?'':'disabled')+' aria-pressed="'+(identity.frame.id===f.id)+'">'+
      '<b>'+esc(f.icon)+' '+esc(f.name)+'</b><small>'+
        (f.unlocked?'UNLOCKED':esc(f.description))+'</small></button>').join('')+
    '</div></section>';
}
function missionBoard() {
  const missions=weeklyMissions(storage.days,today());
  const done=missions.filter(m=>m.complete).length;
  return '<section class="card missions-panel"><div class="section-heading"><div>'+
    '<span class="eyebrow">WEEKLY KNOWLEDGE QUESTS</span><h3>Four ways to grow.</h3>'+
    '<p class="small muted">Play your free official daily. Quests reset Monday UTC; they award cosmetic recognition only.</p></div>'+
    '<span class="mission-count">'+done+' / 4</span></div><div class="mission-grid">'+
    missions.map(m=>'<div class="mission-item '+(m.complete?'done':'')+'">'+
      '<div class="mission-top"><span class="mission-icon">'+esc(m.icon)+'</span><div>'+
        '<strong>'+esc(m.label)+'</strong><small>'+esc(m.description)+'</small></div>'+
        (m.complete?'<span class="mission-done">✓</span>':'')+'</div>'+
      '<div class="mission-bar"><span style="width:'+m.progress+'%"></span></div>'+
      '<div class="mission-foot"><span>'+fmt(m.value)+' / '+fmt(m.goal)+'</span>'+
        '<span>'+esc(m.complete?m.reward:"IN PROGRESS")+'</span></div></div>').join('')+
    '</div><p class="tiny muted">These local achievements are not verified worldwide leaderboards or purchasable boosts.</p></section>';
}
function deepKnowledgePanel() {
  const atlas=atlasProfile(storage.days,today());
  if(!atlas.daysPlayed)return '<section class="card deep-knowledge"><span class="eyebrow">THE KNOWLEDGE ATLAS</span>'+
    '<h3>Every mind has a specialty.</h3><p class="small muted">Finish your first official daily game to begin collecting your strongest subjects and most memorable accepted answers.</p></section>';
  const rareRows=atlas.highest.map((item,i)=>'<div class="rare-memory">'+
    '<span class="memory-rank">'+String(i+1).padStart(2,'0')+'</span>'+
    '<div><strong>'+esc(item.answer)+'</strong><small>'+esc(item.category)+' · '+esc(item.day)+'</small></div>'+
    '<b>'+fmt(item.points)+' PTS</b></div>').join('');
  return '<section class="card deep-knowledge"><span class="eyebrow">THE KNOWLEDGE ATLAS</span>'+
    '<h3>Your rarest memories.</h3><p class="small muted">Your five highest-scoring distinct accepted Stand Out answers from completed official daily games.</p>'+
    '<div class="atlas-metrics"><div><strong>'+fmt(atlas.uniqueRareAnswers)+'</strong><span>UNIQUE RARE ANSWERS</span></div>'+
      '<div><strong>'+atlas.rareAccuracy+'%</strong><span>STAND OUT ACCEPTANCE</span></div>'+
      '<div><strong>'+atlas.crowdAccuracy+'%</strong><span>FIT IN ACCEPTANCE</span></div>'+
      '<div><strong>'+fmt(atlas.recentAverage)+'</strong><span>LAST 7 COMPLETED GAMES AVG</span></div></div>'+
    '<div class="rare-memories">'+(rareRows||'<p class="muted small">Your first rare discovery is still ahead.</p>')+'</div>'+
    '<div class="atlas-strengths">'+(atlas.strongest?'<div><small>STRONGEST SUBJECT BY SCORE</small>'+
      '<strong>'+esc(atlas.strongest.name)+'</strong><p>'+fmt(atlas.strongest.average)+' average points across '+atlas.strongest.attempts+' questions</p></div>':'')+
    (atlas.weakest?'<div><small>ROOM TO GROW</small><strong>'+esc(atlas.weakest.name)+'</strong>'+
      '<p>Explore this subject in unranked practice to build your knowledge.</p></div>':'')+'</div>'+
    '<p class="tiny muted">This is a local browser-only profile, not a claim about worldwide knowledge rankings.</p></section>';
}

function badgeCabinet() {
  const badges = earnedBadges(storage.days);
  return '<div class="card badge-section"><div class="section-heading"><div><h3>Your badge cabinet</h3>' +
    '<p class="muted small" style="margin:0">Little victories, earned from official daily results.</p></div>' +
    '<span class="pill pill-purple">' + badges.filter(b=>b.earned).length + ' / 8 UNLOCKED</span></div>' +
    '<div class="badge-grid">' + badges.map(b =>
      '<div class="achievement ' + (b.earned ? 'unlocked' : 'locked') + '">' +
      '<div class="achievement-art">' + esc(b.icon) + '</div><strong>' + esc(b.title) + '</strong>' +
      '<p>' + esc(b.detail) + '</p><small>' + (b.earned ? '✓ UNLOCKED' : 'LOCKED') + '</small></div>').join("") +
    '</div></div>';
}


function nextClock() {
  return '<span class="reset-clock" id="reset-clock" aria-label="Time until next UTC daily game">--:--:--</span>';
}
function refreshResetClock() {
  const target = document.getElementById("reset-clock");
  if (!target) return;
  const value=utcResetRemaining();
  target.textContent=[value.hours,value.minutes,value.seconds].map(x=>String(x).padStart(2,"0")).join(":");
}
function journeyPreview() {
  const week=weekSummary(storage.days,today());
  const goal=nextGoal(storage.days,today());
  return '<div class="card weekly-quest"><div class="weekly-quest-heading"><div>'+
    '<span class="eyebrow">YOUR WEEKLY MISSION</span><h3>Make every answer count.</h3>'+
    '<p class="muted small">A new personal challenge every week. Only official daily games count.</p></div>'+
    '<div class="weekly-quest-score"><strong>'+week.played+'<small> / 7</small></strong><span>DAYS THIS WEEK</span></div></div>'+
    '<div class="weekly-quest-days">'+week.days.map((item,i)=>'<span class="'+(item.played?'played ':'')+
      (item.day===today()?'today':'')+'" title="'+esc(item.day)+'" aria-label="'+esc(item.day)+
      (item.played?', played':', not played')+'">'+(item.played?'✦':['M','T','W','T','F','S','S'][i])+'</span>').join('')+'</div>'+
    '<div class="weekly-quest-footer"><div><span class="tiny muted">WEEKLY POINTS</span><b>'+fmt(week.total)+'</b></div>'+
    '<div><span class="tiny muted">NEXT PLAY MILESTONE</span><b>'+goal.nextDayMilestone+' DAYS <small>('+goal.daysRemaining+' TO GO)</small></b></div>'+
    '<div><span class="tiny muted">NEXT DAILY RESET</span><b>'+nextClock()+'</b></div></div></div>';
}
function personalJourneyPanel() {
  const history=scoreHistory(storage.days,28,today());
  const week=weekSummary(storage.days,today());
  const goal=nextGoal(storage.days,today());
  const filled=history.filter(d=>d.played);
  return '<div class="card history-chart"><div class="section-heading"><div>'+
    '<span class="eyebrow">YOUR 28-DAY JOURNEY</span><h3>The story behind your scores.</h3>'+
    '<p class="muted small">Every bar is an official daily game. Gaps mean no completed game.</p></div>'+
    '<span class="pill pill-purple">'+filled.length+' GAMES</span></div>'+
    '<div class="history-bars" role="img" aria-label="Your official scores over the past 28 days">'+
    history.map(item=>'<div class="history-bar-day" title="'+esc(item.day)+' · '+
      (item.played?fmt(item.score)+' points':'not played')+'"><div class="history-bar '+
      (item.played?'played':'missed')+'" style="height:'+
      (item.played?Math.max(8,item.score/70):5)+'%"></div></div>').join('')+
    '</div><div class="history-scale"><span>28 DAYS AGO</span><span>TODAY</span></div>'+
    '<div class="journey-metrics">'+
      '<div><small>THIS WEEK</small><strong>'+fmt(week.total)+'</strong><span>POINTS</span></div>'+
      '<div><small>WEEKLY AVG</small><strong>'+fmt(week.average)+'</strong><span>POINTS / DAY PLAYED</span></div>'+
      '<div><small>LONGEST STREAK</small><strong>'+goal.streak+' <small>NOW</small></strong><span>BEST: '+week.longest+' DAYS</span></div>'+
      '<div><small>NEXT MILESTONE</small><strong>'+goal.nextDayMilestone+'</strong><span>COMPLETED GAMES</span></div></div></div>';
}
function resultComparison(day,score) {
  const compare=versusHistory(storage.days,day,score);
  if(!compare)return '<div class="first-run-bonus">✦ Your first official result is in the books. Your journey starts here!</div>';
  const diff=compare.change;
  return '<div class="result-momentum '+(diff>=0?'up':'down')+'"><span>'+
    (compare.personalBest?'🏆 NEW DAILY PERSONAL BEST':diff>=0?'↗ YOU BEAT YOUR LAST GAME':'↗ YOUR NEXT GOAL IS SET')+'</span>'+
    '<strong>'+(diff>=0?'+':'−')+fmt(Math.abs(diff))+' <small>VS. YOUR PREVIOUS DAILY SCORE</small></strong>'+
    '<p>Your earlier daily average was '+fmt(compare.average)+' points. '+
    (compare.aboveAverage?'You scored at or above it today.':'Keep the streak going and try again tomorrow.')+
    '</p></div>';
}


function applyTheme() {
  const state=unlockableThemes(storage.days,storage.theme);
  storage.theme=state.active;
  document.documentElement.dataset.skin=state.active;
}
function seasonPanel() {
  const season=weeklySeason(storage.days,today());
  const archive=seasonArchive(storage.days,today(),4);
  const count=season.completed;
  const goal=season.next?.threshold||7;
  const percentage=Math.min(100,Math.round(count/goal*100));
  return '<div class="card season-panel"><div class="season-head"><div>'+
    '<span class="eyebrow">YOUR WEEKLY SEASON</span><h3>Brains earn their crowns.</h3>'+
    '<p class="small muted">Every Monday–Sunday UTC week is a new seven-day season. Rewards are cosmetic only.</p></div>'+
    '<span class="season-emblem">'+(season.achieved?.symbol||'✧')+'</span></div>'+
    '<div class="season-progress"><div><strong>'+(season.achieved?.name||"New Challenger")+
    '</strong><span>'+count+' of 7 official days completed</span></div><div class="season-track"><span style="width:'+percentage+'%"></span></div>'+
    '<p class="small muted">'+(season.next?season.needed+' more daily '+(season.needed===1?'game':'games')+
    ' to reach '+season.next.name: 'Season Legend! You played all seven days.')+'</p></div>'+
    '<div class="season-tiers">'+season.tiers.map(t=>
    '<div class="'+(count>=t.threshold?'unlocked':'locked')+'"><strong>'+t.symbol+'</strong><span>'+t.name+'</span>'+
      '<small>'+t.threshold+' DAYS</small></div>').join('')+'</div>'+
    (archive.length?'<div class="season-history"><strong>PAST SEASONS</strong>'+
      archive.map(a=>'<span title="'+esc(a.start)+'">'+esc(a.badge)+' · '+a.completed+'/7</span>').join('')+'</div>':'')+
    '</div>';
}
function themesPanel() {
  const state=unlockableThemes(storage.days,storage.theme);
  return '<div class="card cosmetics-panel"><div class="eyebrow">COLLECTIBLE GAME STYLES</div>'+
    '<h3>Make OUTLIER yours.</h3><p class="small muted">Unlock color themes just by finishing official daily games. No purchases or score boosts.</p>'+
    '<div class="theme-grid">'+state.themes.map(t=>'<button type="button" class="theme-choice '+(state.active===t.id?'selected':'')+
      '" data-action="theme" data-theme="'+t.id+'" aria-pressed="'+(state.active===t.id)+'" '+(!t.unlocked?'disabled':'')+'>'+
      '<span class="theme-orb '+t.id+'">'+t.symbol+'</span><strong>'+esc(t.name)+'</strong>'+
      '<small>'+(t.unlocked?(state.active===t.id?'ACTIVE · CLICK TO KEEP':'UNLOCKED'):'LOCKED · '+t.remaining+' MORE DAYS')+
      '</small></button>').join('')+'</div></div>';
}
function betaPanel() {
  const checklist=betaChecklistState(storage.days,{
    tutorial:storage.beta?.tutorial,
    practice:storage.beta?.practice,
    shared:storage.beta?.shared
  });
  const done=checklist.filter(x=>x.done).length;
  return '<div class="card beta-panel"><div><span class="eyebrow">HELP SHAPE THE BETA</span>'+
    '<h3>Be one of the first OUTLIERS.</h3>'+
    '<p class="small muted">Try all four steps, then tell us what feels great and what needs work. We don\'t upload your browser history automatically.</p>'+
    '<div class="beta-tasks">'+checklist.map(task=>'<span class="'+(task.done?'done':'')+'">'+
      (task.done?'✓':'○')+' '+esc(task.label)+'</span>').join('')+'</div>'+
    '<strong class="beta-count">'+done+' OF '+checklist.length+' COMPLETED</strong></div>'+
    '<div class="beta-actions">'+homeButton('SEND GAME FEEDBACK ↗','feedback','btn-teal')+
    homeButton('REPLAY TUTORIAL','tour','btn-ghost')+'</div></div>';
}
function openTour(page=0) {
  tourPage=Math.max(0,Math.min(TOUR_STEPS.length-1,page));
  const t=TOUR_STEPS[tourPage];
  modalRoot.innerHTML='<div class="rules-modal-backdrop tour-backdrop"><section class="card tour-modal" role="dialog" aria-modal="true" aria-label="OUTLIER first-time tutorial" id="tour-dialog" tabindex="-1">'+
    '<div class="tour-head"><span class="eyebrow">'+t.eyebrow+'</span>'+
    '<button type="button" class="tour-skip" data-action="tour-skip">SKIP INTRO</button></div>'+
    '<div class="tour-hero">'+t.symbol+'</div><h2>'+esc(t.title)+'</h2><p>'+esc(t.description)+'</p>'+
    '<div class="tour-hint">'+esc(t.hint)+'</div><div class="tour-progress">'+TOUR_STEPS.map((_,i)=>
      '<span class="'+(i===tourPage?'active':i<tourPage?'seen':'')+'"></span>').join('')+'</div>'+
    '<div class="tour-actions">'+(tourPage>0?homeButton('← PREVIOUS','tour-prev','btn-ghost'):'')+
      homeButton(tourPage===TOUR_STEPS.length-1?'START PLAYING →':'NEXT →','tour-next','btn-primary')+
    '</div></section></div>';
  modalRoot.querySelector("#tour-dialog")?.focus();
}
function finishTour() {
  storage.beta.tutorial=true;
  tourWasSeenThisSession=true;
  saveStore();
  modalRoot.replaceChildren();
  if(screen==="home")renderHome();
}
function openFeedback() {
  const url=safeFeedbackUrl("https://github.com/dokeefe414/Outlier-Trivia/issues/new",
    "Design feedback");
  window.open(url,"_blank","noopener,noreferrer");
  toast("GitHub sign-in is needed to submit feedback. Please avoid including private information.");
}

function stat(label, value) {
  return '<div class="stat"><div class="stat-label">' + label + '</div><div class="stat-value">' + value + '</div></div>';
}
function toast(message) {
  clearTimeout(toastTimeout);
  toastNode.textContent = message;
  toastNode.classList.add("visible");
  toastTimeout = setTimeout(() => toastNode.classList.remove("visible"), 3000);
}
function sound(frequency = 600, duration = .12) {
  if (!storage.sound) return;
  try {
    soundContext = soundContext || new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = soundContext.createOscillator();
    const gain = soundContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, soundContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.24, soundContext.currentTime + duration);
    gain.gain.setValueAtTime(.045, soundContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, soundContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(soundContext.destination);
    oscillator.start();
    oscillator.stop(soundContext.currentTime + duration);
  } catch { /* Sound is optional. */ }
}
function renderSound() {
  const button = document.querySelector('[data-action="sound"]');
  if (!button) return;
  button.setAttribute("aria-label", storage.sound ? "Disable sounds" : "Enable sounds");
  const label = button.querySelector(".sound-label");
  if (label) label.textContent = storage.sound ? "Sound on" : "Sound off";
}
async function showOnline() {
  screen = "online";
  clearInterval(intervalId);
  app.innerHTML = '<div class="loading"><div class="spinner"></div><p>Connecting to online league...</p></div>';
  try {
    const {mountOnline} = await import("./online.js");
    await mountOnline(app,renderHome);
  } catch (error) {
    console.error("Could not initialize hosted mode:",error);
    renderHome();
    toast("Online league could not open. You can still play the free daily game.");
  }
}

// v1.3: real answers and fixed editorial scoring, not imaginary survey results.
function debriefPanel(questions,answers) {
  const d=dailyDebrief(questions,answers);
  const rare=d.bestRare?'<strong>'+esc(d.bestRare.accepted)+'</strong><span>'+fmt(d.bestRare.points)+' editorial points · '+esc(d.bestRare.category)+'</span>':
    '<strong>Still hunting</strong><span>No approved Stand Out answer was locked in.</span>';
  const crowd=d.bestFit?'<strong>'+esc(d.bestFit.accepted)+'</strong><span>'+fmt(d.bestFit.points)+' points · your strongest Fit In pick</span>':
    '<strong>Keep predicting</strong><span>No Fit In pick was recorded in this game.</span>';
  const notes=d.rows.filter(r=>r.valid&&r.prompt).sort((a,b)=>b.points-a.points).slice(0,2)
    .map(r=>'<div class="v13-note"><span>FIELD NOTE · '+esc(r.category)+'</span>'+
      '<p>'+esc(r.prompt)+'</p><strong>Your accepted pick: '+esc(r.accepted)+'</strong></div>').join('');
  const ledger=d.categories.map(row=>
    '<div class="v13-category-row"><span>'+esc(row.name)+'</span><strong>'+fmt(row.points)+' / '+fmt(row.rounds*1000)+'</strong></div>').join('');
  return '<section class="card v13-debrief" aria-labelledby="v13-debrief-title">'+
    '<div class="eyebrow">ISSUE 01 / AFTER THE BUZZER</div>'+
    '<h2 id="v13-debrief-title">YOUR DAILY DEBRIEF.</h2>'+
    '<p class="muted">A closer look at what you actually knew. '+d.accepted+' of '+d.rounds+' accepted picks; no fictional player rankings.</p>'+
    '<div class="v13-debrief-cards"><div><small>✦ YOUR DEEPEST CUT</small>'+rare+'</div>'+
    '<div><small>◎ YOUR SHARPEST CROWD CALL</small>'+crowd+'</div>'+
    '<div><small>↗ NEXT TIME</small><strong>'+ (d.missed.length?
      'Reclaim '+d.missed.length+' missed '+(d.missed.length===1?'round':'rounds'):
      'Try an even stranger answer')+'</strong><span>'+
      (d.missed.length?'Replay the subjects in unranked practice.':'Your approved picks filled every round. Explore the full answer library for deeper cuts.')+'</span></div></div>'+
    (notes?'<div class="v13-field-notes"><h3>REMEMBER THESE PICKS</h3>'+notes+
      '<p class="small muted">Prompts and accepted entries come from the approved library; editorial scores are not measured player popularity.</p></div>':'')+
    '<details class="v13-category-ledger"><summary>CATEGORY SCORE LEDGER</summary>'+ledger+'</details>'+
    '</section>';
}
function spotlightPanel() {
  const event=weeklySpotlight(today());
  const record=storage.arcade["spotlight:"+event.id];
  return '<section class="v13-spotlight" aria-labelledby="v13-spotlight-title">'+
    '<div><div class="eyebrow">WEEKLY SPOTLIGHT / '+esc(event.week)+'</div>'+
    '<h2 id="v13-spotlight-title">'+esc(event.icon)+' '+esc(event.title)+'</h2>'+
    '<p>'+esc(event.description)+'. Ten quick rare-answer rounds, one identical weekly slate for every player.</p>'+
    '<small>30 SEC EACH · 10,000 MAX · UNRANKED · RESETS MONDAY UTC</small>'+
    (record?.runs?'<div class="v13-week-best">YOUR WEEKLY BEST · '+fmt(record.best)+' PTS · '+fmt(record.runs)+' RUNS</div>':'')+
    '</div>'+homeButton('PLAY THIS WEEK’S CHALLENGE ↗','weekly-event','btn-primary')+'</section>';
}

function renderHome() {
  screen = "home";
  clearInterval(intervalId);
  const record = storage.days[today()];
  const stats = lifetimeStats(storage.days);
  const played = Boolean(record?.complete);
  const started = Boolean(record?.answers?.length || record?.deadline);
  const action = ONLINE_ENABLED ? "online" : played ? "result" : "daily";
  const actionLabel = ONLINE_ENABLED ? "COMPETE ONLINE TODAY →" : played ? "VIEW TODAY'S RESULTS ↗" : started ? "CONTINUE TODAY'S GAME →" : "PLAY TODAY'S GAME →";
  applyTheme();
  app.innerHTML = [
    '<section class="hero hero-editorial"><div class="hero-copy">',
    '<div class="editorial-overline"><span class="overline-index">/ 001</span><span>THE DAILY GAME FOR WEIRDLY SPECIFIC PEOPLE</span></div>',
    '<h1>THINK <span class="headline-odd">ODD<span class="headline-period">.</span></span><br><span class="headline-right">BE RIGHT<span class="headline-period">.</span></span></h1>',
    '<p class="hero-description">Know the kind of random stuff nobody ever asks you about? Good. This is your game. Seven questions. Four deep cuts. Three crowd calls. One shot a day.</p>',
    '<div class="hero-actions">',
    homeButton(actionLabel, action), ONLINE_ENABLED ?
      homeButton("PLAY FREE AS GUEST", "daily", "btn-ghost") :
      homeButton("TRY PRACTICE MODE", "practice", "btn-ghost"),
    '</div>' + (friendChallenge && friendChallenge.current ?
      '<div class="friend-challenge"><div class="friend-burst">⚔</div><div><strong>A FRIEND CHALLENGED YOU!</strong><p>Beat their ' + fmt(friendChallenge.score) +
      '-point score on today\'s seven questions.</p></div></div>' :
      friendChallenge ? '<div class="friend-challenge expired"><div class="friend-burst">◷</div><div><strong>THIS CHALLENGE HAS EXPIRED</strong><p>That shared score was from a different day. Play today\'s new questions instead.</p></div></div>' : '') +
    '<div class="play-info"><span><b>01</b> FREE DAILY</span><span><b>03</b> MINUTES(ISH)</span><span><b>07</b> QUESTIONS</span></div>',
    '<div class="hero-signoff"><span class="signoff-arrow" aria-hidden="true">↗</span><span>YOU EITHER KNOW IT OR YOU DON\'T.<br><b>THAT\'S THE FUN PART.</b></span></div>',
    '</div><div class="poster-scene" aria-hidden="true">',
    '<div class="poster-frame"><div class="poster-masthead"><span>THE OUTLIER CLUB</span><span>EST. 2026 / ISSUE 001</span></div>',
    '<div class="poster-main"><div class="poster-big-number">07<span>!</span></div>',
    '<div class="poster-punchline"><span>ALL THE</span><strong>WRONG<br>ANSWERS.</strong><em>UNTIL YOU\'RE RIGHT.</em></div>',
    '<div class="poster-arrows"><span>↘</span><span>↗</span></div></div>',
    '<div class="poster-disc"><span>BE THE<br>OUTLIER</span><b>✳</b></div>',
    '<div class="poster-lower"><span>04 <b>STAND OUT</b></span><i></i><span>03 <b>FIT IN</b></span></div>',
    '<div class="poster-bottom"><span>NO CHEAT CODES. JUST CURIOUS MINDS.</span><strong>O / 01</strong></div></div>',
    '<div class="poster-edge-label">HAND-PICKED FACTS / QUESTIONABLY USEFUL KNOWLEDGE</div></div></section>',
    '<section class="home-bottom"><div class="section-heading"><div><div class="eyebrow" style="margin-bottom:12px">THE RULES, MORE OR LESS</div><h2>TWO WAYS TO <span class="section-underline">OUTSMART</span> EVERYONE.</h2></div>',
    '<span class="pill pill-yellow">NEW QUESTIONS EVERY DAY</span></div>',
    '<div class="feature-grid">',
    '<div class="card feature-card feature-rare"><span class="feature-tail">01</span><span class="feature-icon">↗</span><span class="pill pill-purple">4 / 7 ROUNDS</span><h3>STAND OUT.</h3><p>Know a ridiculous deep cut? Put it down. The less obvious your answer, the better.</p></div>',
    '<div class="card feature-card feature-fit"><span class="feature-tail">02</span><span class="feature-icon">◎</span><span class="pill pill-teal">3 / 7 ROUNDS</span><h3>FIT IN.</h3><p>Forget your own taste. Guess what everybody else would say. Read the room.</p></div>',
    '<div class="card feature-card feature-keep"><span class="feature-tail">03</span><span class="feature-icon">Ⅲ</span><span class="pill pill-yellow">DAILY RITUAL</span><h3>SHOW UP AGAIN.</h3><p>One official go each day. Collect your odd little wins and build a record worth keeping.</p></div>',
    '</div>',
    spotlightPanel(),
    '<div class="stats-strip">
    stat("CURRENT STREAK", currentStreak(storage.days,today()) + " 🔥"),
    stat("LIFETIME AVERAGE", fmt(stats.average)),
    stat("LIFETIME POINTS", fmt(stats.total)),
    stat("PERSONAL BEST", fmt(stats.best)),
    '</div>' + progressPanel() + journeyPreview() + missionBoard() + playerCardPreview() + seasonPanel() + themesPanel() + betaPanel() + '</section>',
    '<section class="promo"><div><span class="pill pill-purple" style="margin-bottom:13px">' +
      (ONLINE_ENABLED ? 'ONLINE LEAGUE' : 'COMING AFTER THE PROTOTYPE') + '</span>',
    '<h3>WANT ANOTHER ROUND?</h3><p>' + (ONLINE_ENABLED ?
      'Compete on global leaderboards. Unlimited ranked-independent practice is a lifetime unlock.' :
      'Unlimited rounds, categories, and verified global competition are planned. Practice is temporarily free for prototype testing.') +
      '</p></div>',
    '<div class="promo-price">$4.99<small>ONE TIME · ' + (ONLINE_ENABLED ? 'ONLINE CHECKOUT' : 'NOT ACTIVE YET') + '</small></div>' +
      (ONLINE_ENABLED ? '<div>' + homeButton('JOIN THE LEAGUE →','online','btn-teal') + '</div>' : '') +
      '</section>'
  ].join("");
  window.scrollTo(0,0);
  refreshResetClock();
  intervalId=setInterval(refreshResetClock,1000);
}

function renderPracticeSelect() {
  screen="practice-select";
  clearInterval(intervalId);
  const total=rareQuestions.filter(q=>q.bigPool).length;
  app.innerHTML='<section class="practice-select">' + spotlightPanel() +
    '<button type="button" class="back-link" data-action="home">← BACK TO HOME</button>' +
    '<div class="practice-heading"><span class="eyebrow">THE KNOWLEDGE ARCADE</span>' +
    '<h1>PICK YOUR <span class="gradient-text">PLAYGROUND.</span></h1>' +
    '<p class="muted">Choose a subject, then pick your format. Four rare answers and three crowd predictions in Classic—or test your instincts in quicker and tougher challenges.</p>' +
    '<div class="practice-meta"><span>✦ '+total+' BROAD RARE-ANSWER PROMPTS</span><span>◎ '+fitQuestions.length+' CROWD QUESTIONS</span><span>♾ UNRANKED TEST PRACTICE</span></div></div>' +
    '<div class="arcade-format-grid" role="group" aria-label="Practice format">' +
      arcadeFormats.map(format => '<button type="button" class="arcade-format '+(practiceFormat===format.value?'selected':'')+
      '" data-action="practice-format" data-format="'+format.value+'" aria-pressed="'+(practiceFormat===format.value)+'">'+
      '<span class="arcade-format-icon">'+format.icon+'</span><strong>'+format.title+'</strong>'+
      '<span>'+format.description+'</span><small>'+format.rounds+' ROUNDS · '+format.seconds+' SEC EACH</small></button>').join('')+
      '</div><div class="practice-grid">' + practiceCategoryOptions.map(option => {
      const matches=rareQuestions.filter(q=>q.bigPool && q.poolGroup===option.value);
      return '<button type="button" data-action="start-practice" data-group="'+esc(option.value)+'" class="practice-option '+(option.value==="surprise"?"featured":"")+'">'+
        '<span class="practice-art">'+option.icon+'</span><strong>'+esc(option.label)+'</strong>'+
        '<span class="practice-description">'+esc(option.detail)+'</span>'+
        '<span class="practice-count">'+(option.value==="surprise"?"ALL CATEGORIES":matches.length+" RARE PROMPTS")+' <b>↗</b></span></button>';
    }).join("")+'</div><p class="practice-footnote">Practice is free during beta testing. It never affects official daily or lifetime leaderboards. The $4.99 lifetime unlock is not active yet.</p></section>';
  window.scrollTo(0,0);
}

function newSession(mode,practiceGroup = 'surprise') {
  clearInterval(intervalId);
  feedback = null;
  if (mode === "daily") {
    const day = today();
    const existing = storage.days[day];
    session = {
      mode, day, questions: (() => {
        if (Array.isArray(existing?.questionIds) && existing.questionIds.length === 7) {
          const bank = [...rareQuestions, ...fitQuestions];
          const matched = existing.questionIds.map(id => bank.find(q => q.id === id));
          if (matched.every(Boolean)) return matched.map((q,index)=>({...q,type:q.choices?"fit":"rare",index}));
        }
        // Restore original set for daily games started before v0.2.
        return existing?.startedAt ? buildLegacyRound(day) : buildRound(day);
      })(),
      answers: Array.isArray(existing?.answers) ? existing.answers.slice(0, 7) : [],
      index: Array.isArray(existing?.answers) ? Math.min(existing.answers.length, 7) : 0,
      deadline: existing?.deadline ?? null
    };
    if (existing?.complete || session.index >= 7) { renderResult(); return; }
  } else if (mode === "spotlight") {
    const event=weeklySpotlight(today());
    session={mode:"practice",day:today(),practiceGroup:event.category,practiceFormat:"weekly-spotlight",
      weeklyEvent:event.id,questions:weeklySpotlightRound(today()),timerSeconds:30,
      answers:[],index:0,deadline:null,arcadeRecorded:false};
  } else {
    const format = arcadeFormats.find(item=>item.value===practiceFormat) || arcadeFormats[0];
    session = {mode,day:today(),practiceGroup,practiceFormat:format.value,
      questions:buildArcadeRound(today(),practiceGroup,format.value),
      timerSeconds:format.seconds,answers:[],index:0,deadline:null,arcadeRecorded:false};
  }
  renderGame();
}

function currentQuestion() {
  return session?.questions[session.index] || null;
}
function roundDots() {
  return '<div class="round-dots" aria-label="Round progress">' +
    session.questions.map((q, index) => {
      const state = index < session.index ? "done" : index === session.index ? "active" : "";
      return '<span class="round-dot ' + q.type + ' ' + state + '" title="Question ' + (index+1) + ': ' + q.type + '"></span>';
    }).join("") + '</div>';
}
function renderGame() {
  if (!session) return renderHome();
  const q = currentQuestion();
  if (!q) return renderResult();
  screen = "game";
  clearInterval(intervalId);
  if (session.retryQuestionIndex !== session.index) {
    session.retryQuestionIndex=session.index;
    session.retryAttempts=0;
    session.lastInvalid=null;
  }
  if (!session.deadline) session.deadline = Date.now() + (session.timerSeconds||QUESTION_SECONDS) * 1000;
  saveDaily();
  const fit = q.type === "fit";
  const optionContent = fit ?
    '<div class="answer-label">WHICH ANSWER WOULD WIN THE CROWD?</div><div class="fit-options">' +
    shuffled(q.choices, session.mode === "daily" ? randomFromSeed(seedFromString(session.day + q.id + "-order")) : Math.random)
      .map(([name],i) => '<button class="fit-option" data-action="fit-answer" data-answer="' + esc(name) + '"><span>' + esc(name) + '</span><span>' + String.fromCharCode(65+i) + '</span></button>').join("") +
    '</div><p class="keyboard-hint">QUICK PICK: PRESS A–F OR 1–6</p>'
  :
    '<form id="rare-form" autocomplete="off"><label class="answer-label" for="rare-answer">YOUR MOST UNEXPECTED CORRECT ANSWER</label>' +
    '<div class="answer-row"><input id="rare-answer" class="answer-input" name="answer" type="text" maxlength="80" placeholder="Type your answer..." required spellcheck="false" autocapitalize="words" aria-describedby="answer-validation">' +
    '<button class="btn btn-primary" type="submit">LOCK IT IN →</button></div>' +
    '<p id="answer-validation" class="answer-validation" role="status" aria-live="polite" hidden></p>' +
    '<p id="retry-counter" class="retry-counter" aria-live="off"></p>' +
    '<p class="retry-hint">Keep guessing until an approved answer is found. Rejected guesses never restart the timer.</p></form>';
  app.innerHTML = [
    '<div class="game-wrap"><div class="topbar"><button class="back-link" data-action="home" type="button">← BACK TO HOME</button>',
    '<span class="session-pill">' + (session.mode === "daily" ? 'DAILY · ' + esc(session.day) : (session.weeklyEvent ? "WEEKLY SPOTLIGHT · " : "PRACTICE · ") + esc((session.practiceGroup||"surprise").toUpperCase())) + '</span></div>',
    '<div class="game-head"><div><div class="eyebrow" style="margin-bottom:10px">TODAY\'S FIELD TEST</div>',
    '<h2>Question ' + (session.index + 1) + ' <span class="muted">/ ' +session.questions.length+'</span></h2><p>Think sideways. Trust the weird stuff you know.</p></div>',
    '<div class="game-score" aria-label="Current game score"><div class="tiny muted">YOUR SCORE</div><strong>' + fmt(scoreOf(session.answers)) + '</strong></div></div>',
    '<div class="progress-track"><div class="progress-fill" style="width:' + (session.index/session.questions.length*100) + '%"></div></div>',
    roundDots(),'<article class="card question-card ' + q.type + '">',
    '<div class="question-head"><span class="pill ' + (fit ? "pill-teal" : "pill-purple") + '">' + (fit ? "◎ FIT IN — MATCH THE CROWD" : "✦ STAND OUT — BE THE EXCEPTION") + '</span>',
    '<div id="timer" class="timer" role="timer" aria-label="Time remaining" aria-live="off">0:45</div></div>',
    '<div class="time-track" role="presentation"><div id="timebar" class="time-fill"></div></div>',
    '<div class="question-category">' + esc(q.category) + ' · ROUND ' + (session.index+1) + '</div>',
    '<h2 class="question-prompt">' + esc(q.prompt) + '</h2>',
    '<p class="question-detail">' + esc(fit ? "Six options. Only one is the crowd favorite. Pick the answer you think most people would choose." : q.detail) + '</p>',
    optionContent,
    '<div class="question-foot"><span class="question-legend ' + q.type + '"><i></i>' + (fit ? "Highest crowd match = 1,000 pts" : "Rarer approved answers = more points") + '</span>',
    '<button type="button" class="skip" data-action="skip">Skip this question</button></div>',
    '</article></div>'
  ].join("");
  if (!fit) document.getElementById("rare-answer")?.focus({preventScroll:true});
  window.scrollTo(0,0);
  tickTimer();
  intervalId = setInterval(tickTimer, 150);
}

function tickTimer() {
  if (screen !== "game" || !session) return;
  const remaining = Math.max(0, Math.ceil((session.deadline - Date.now()) / 1000));
  const timer = document.getElementById("timer");
  if (timer) {
    timer.textContent = '0:' + String(remaining).padStart(2,'0');
    timer.classList.toggle("urgent",remaining <= 10);
  }
  const bar = document.getElementById("timebar");
  if (bar) {
    bar.style.width = Math.max(0,Math.min(100,((session.deadline - Date.now()) / ((session.timerSeconds||QUESTION_SECONDS) * 1000))*100)) + "%";
    bar.classList.toggle("urgent",remaining <= 10);
  }
  if (remaining === 0) submitAnswer(null);
}

function submitAnswer(value) {
  if (screen !== "game" || !session) return;
  const q = currentQuestion();
  // Keep the original deadline through every failed guess. Only an
  // accepted answer, explicit skip, or timer expiry completes the round.
  const expired = Date.now() >= session.deadline;
  const submitted = value === null || expired ? null : value;
  const result = evaluate(q, submitted);
  if (submitted !== null && !result.valid) {
    session.retryAttempts=(session.retryAttempts||0)+1;
    session.lastInvalid=String(submitted).slice(0,80);
    const diagnostic=inspectRareGuess(q,submitted);
    const field=document.getElementById("rare-answer");
    const warning=document.getElementById("answer-validation");
    const counter=document.getElementById("retry-counter");
    if (warning) {
      warning.textContent=diagnostic.status==="ambiguous"
        ? "This spelling could refer to multiple approved answers. Try a more specific name."
        : "Not in our approved answer library yet. Try a different name or spelling!";
      warning.hidden=false;
      warning.classList.remove("retry-bounce");
      void warning.offsetWidth;
      warning.classList.add("retry-bounce");
    }
    if(counter)counter.textContent=session.retryAttempts+" "+(session.retryAttempts===1?"guess":"guesses")+" not accepted • No points lost";
    if(field) {
      field.value="";
      field.setAttribute("aria-invalid","true");
      field.focus({preventScroll:true});
    }
    sound(250,.07);
    return;
  }
  clearInterval(intervalId);
  feedback={question:q,result,number:session.index+1,
    rejectedGuess:!result.valid ? session.lastInvalid : null};
  session.answers.push(result);
  session.deadline = null;
  saveDaily();
  sound(result.points > 0 ? 580 : 220, .14);
  renderFeedback();
}

function feedbackHeading(result) {
  if (!result.valid) return { title:"NO POINTS THIS TIME", icon:"⌛", description:"No accepted answer was locked in. Tomorrow is another shot." };
  if (result.type === "fit") {
    if (result.points === 1000) return { title:"CROWD MIND READER!", icon:"◎", description:"You found the most popular answer in our prototype crowd board." };
    if (result.points >= 500) return { title:"YOU KNOW THE CROWD!", icon:"◉", description:"A strong prediction — you were thinking with the majority." };
    return { title:"DIFFERENT WAVELENGTH!", icon:"◌", description:"Sometimes your instincts are more unusual than the crowd." };
  }
  if (result.points >= 850) return { title:"ABSOLUTE OUTLIER!", icon:"💎", description:"An especially obscure choice in our curated scoring tiers." };
  if (result.points >= 600) return { title:"RARE FIND!", icon:"✦", description:"You went beyond the obvious. Nice thinking." };
  if (result.points >= 350) return { title:"SOLID ANSWER!", icon:"✳", description:"Correct, and a little unexpected." };
  return { title:"CORRECT, BUT COMMON!", icon:"✓", description:"You got it right. Go for a deeper cut next time." };
}


function answerExplorer(question) {
  if (!question.bigPool) return "";
  const ranked = [...question.answers].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]));
  const rows = ranked.map(([name,points,aliases=[]])=> {
    const haystack=normalizeAnswer([name,...aliases].join(" "));
    return '<div class="explorer-row" data-search="'+esc(haystack)+'">'+
      '<strong>'+esc(name)+'</strong><span>'+fmt(points)+' pts</span></div>';
  }).join("");
  return '<details class="answer-explorer"><summary>EXPLORE ALL '+question.answers.length+
    ' VALID ANSWERS <span class="explorer-plus">+</span></summary>'+
    '<div class="answer-explorer-body"><p class="small muted">These are the accepted answers for this category, sorted from highest to lowest prototype rarity points. '+
    'Rarity tiers are estimates, not live crowd percentages.</p>'+
    '<label class="answer-label" for="answer-explorer-filter">FIND AN ANSWER</label>'+
    '<input id="answer-explorer-filter" type="search" class="answer-input" placeholder="Search names or accepted aliases..." autocomplete="off">'+
    '<div class="answer-explorer-results">'+rows+'</div>'+
    '<p id="answer-explorer-empty" class="small muted" hidden>No approved answers match that search.</p></div></details>';
}

function renderFeedback() {
  if (!feedback || !session) return;
  screen = "feedback";
  clearInterval(intervalId);
  const q = feedback.question;
  const result = feedback.result;
  const info=feedbackHeading(result);
  const fit=q.type==="fit";
  const moment=describeRareMoment(q,result);
  const momentBanner=moment?'<div class="rare-moment moment-'+esc(moment.intensity)+'" aria-label="'+esc(moment.tagline)+'">'+
    '<div class="moment-rays" aria-hidden="true">'+Array.from({length:12},(_,i)=>
      '<span style="--ray:'+i+'"></span>').join('')+'</div>'+
    '<div class="moment-emblem" aria-hidden="true">'+(moment.intensity==="legendary"?'✹':moment.intensity==="diamond"?'💎':'✦')+'</div>'+
    '<strong>'+esc(moment.tagline)+'</strong>'+
    '<p>'+esc(moment.explanation)+'</p>'+
    '<small>'+esc(moment.sourceNote)+'</small></div>':'';
  const insight=scoreExplanation(result,q);
  const tier=insight?'<div class="scoring-insight"><span class="rarity-pill">✦ '+esc(insight.band)+'</span>'+
    '<strong>'+esc(insight.match)+'</strong><p>'+esc(insight.detail)+'</p></div>':"";
  const topScore = q.type === "rare"
    ? [...q.answers].sort((a,b) => b[1]-a[1]).slice(0,4)
      .map(([name,points]) => '<span class="answer-chip">' + esc(name) + ' · ' + fmt(points) + '</span>').join("")
    : [...q.choices].sort((a,b) => b[1]-a[1]).map(([name,share]) =>
      '<div class="bar-row ' + (result.accepted === name ? 'selected' : '') + '"><div class="bar-label"><span>' + esc(name) +
      (result.accepted === name ? ' ✦ YOUR PICK' : '') + '</span><span>' + share + '%</span></div>' +
      '<div class="bar-bg"><div class="bar-fg" style="width:' + (share / Math.max(...q.choices.map(([,s])=>s)) * 100) + '%"></div></div></div>'
      ).join("");
  app.innerHTML = [
    '<div class="feedback-wrap"><div class="topbar"><span class="session-pill">ROUND ' + feedback.number + ' OF '+session.questions.length+'</span>',
    '<span class="pill ' + (fit ? 'pill-teal' : 'pill-purple') + '">' + (fit ? '◎ FIT IN' : '✦ STAND OUT') + '</span></div>',
    '<article class="card feedback-card ' + q.type + '">',
    '<div class="text-center"><div class="feedback-graphic" aria-hidden="true">' + info.icon + '</div>',
    '<div class="eyebrow" style="justify-content:center;margin-bottom:15px">ANSWER LOCKED</div>',
    '<div class="feedback-title">' + info.title + '</div>',
    '<div class="feedback-points gradient-text '+(!fit && result.points>=850?'high-rarity':'')+'" role="status" aria-live="polite">+' + fmt(result.points) + '</div>',
    '<div class="feedback-name">' + esc(result.accepted || (result.response ? '"' + result.response + '" — not in the approved answer set' : 'No answer submitted')) + '</div>',
    '<p class="small">' + info.description + '</p>',
    momentBanner,
    '<span class="pill pill-yellow">TOTAL ' + fmt(scoreOf(session.answers)) + ' PTS</span>'+tier+'</div>',
    '<div class="feedback-divider"></div>',
    '<div class="feedback-subhead">' + (fit ? 'THE PROTOTYPE CROWD BOARD' : 'SOME OF THE RAREST ACCEPTED ANSWERS') + '</div>',
    fit ? topScore : '<div class="answer-chips">' + topScore + '</div>',
    answerExplorer(q),
    !fit?'<div class="answer-suggestion"><div><strong>KNOW ANOTHER VALID ANSWER?</strong>'+
      '<p class="small muted">Our finite approved lists improve through source-checked suggestions. Help us catch omissions.</p></div>'+
      homeButton('SUGGEST A VERIFIED ANSWER ↗','suggest-answer','btn-outline')+'</div>':'',
    (!result.valid && !fit && feedback.rejectedGuess) ?
      '<div class="answer-report"><span>Think your answer should count?</span>'+
      homeButton('REQUEST AN ANSWER REVIEW ↗','report-answer','btn-outline')+'</div>' : '',
    '<p class="insight">' + (fit ?
      'These percentages are fixed example values for the prototype, NOT survey data or live player votes. Everyone gets the same score for the same pick.' :
      'Stand Out scores are curated prototype rarity tiers, NOT actual frequencies from other players. Answers are checked against a finite validated list.') + '</p>',
    homeButton(feedback.number===session.questions.length ? 'SEE MY FINAL RESULTS →' : 'NEXT QUESTION →', "next", fit ? "btn-teal btn-wide feedback-next" : "btn-primary btn-wide feedback-next"),
    '</article></div>'
  ].join("");
  window.scrollTo(0,0);
  // The next action is always keyboard reachable after a result reveal.
  app.querySelector(".feedback-next")?.focus({preventScroll:true});
}

function nextRound() {
  if (screen !== "feedback" || !session) return;
  session.index += 1;
  feedback = null;
  if (session.index >= session.questions.length) return renderResult();
  renderGame();
}

function renderResult() {
  if (!session) return renderHome();
  screen = "result";
  clearInterval(intervalId);
  session.deadline = null;
  saveDaily();
  const score = scoreOf(session.answers);
  const maxScore = arcadeMaximum(session.questions);
  const tier = getTier(Math.round(score / maxScore * MAX_SCORE));
  const rival = session.mode==="daily" ? challengeOutcome(friendChallenge,session.day,score) : null;
  const daily = session.mode === "daily";
  const totalStats = lifetimeStats(storage.days);
  const rareScore = scoreOf(session.answers.filter(a => a.type === "rare"));
  const rareMax = session.questions.filter(q=>q.type==="rare").length*1000;
  const fitMax = session.questions.filter(q=>q.type==="fit").length*1000;
  let arcadeRecord=null;
  if (!daily && !session.arcadeRecorded) {
    storage.beta.practice=true;
    const key=session.weeklyEvent ? "spotlight:"+session.weeklyEvent : (session.practiceFormat||"classic")+":"+(session.practiceGroup||"surprise");
    const previous=storage.arcade[key] || {best:0,runs:0};
    arcadeRecord={previous:previous.best,personalBest:score>previous.best,format:session.practiceFormat||"classic"};
    storage.arcade[key]={best:Math.max(previous.best,score),runs:previous.runs+1};
    session.arcadeRecorded=true;
    saveStore();
  }
  const fitScore = scoreOf(session.answers.filter(a => a.type === "fit"));
  const previousOfficial = {...storage.days};
  if (daily) delete previousOfficial[session.day];
  const formerBadges = new Set(earnedBadges(previousOfficial).filter(b=>b.earned).map(b=>b.id));
  const unlockedToday = daily ? earnedBadges(storage.days).filter(b=>b.earned && !formerBadges.has(b.id)) : [];
  const breakdown = session.answers.map((answer,i) =>
    '<div class="breakdown-line"><div class="breakdown-name"><span class="mini-icon">' + (answer.type==="rare"?"💎":"◎") +
    '</span><span>Q' + (i+1) + ' · ' + esc(answer.category) + ' · ' + esc(answer.accepted || "No valid answer") +
    '</span></div><strong>+' + fmt(answer.points) + '</strong></div>').join("");
  const tiles = session.answers.map(a => '<div class="score-tile ' + a.type + '"><span class="tile-icon">' +
    (a.points>=800?'✦':a.points>=500?'●':a.points>0?'◇':'×') +
    '</span><small>' + (a.points>=1000?'1k':Math.round(a.points/10)/100 + 'k') + '</small></div>').join("");
  app.innerHTML = [
    '<div class="result-wrap"><div class="topbar"><button class="back-link" type="button" data-action="home">← BACK TO HOME</button>',
    '<span class="session-pill">' + (daily ? 'DAILY FINISHED' : session.weeklyEvent ? 'WEEKLY SPOTLIGHT FINISHED · UNRANKED' : 'PRACTICE FINISHED · UNRANKED') + '</span></div>',
    '<div class="card result-scorecard"><div class="result-crown" aria-hidden="true">🏆</div>',
    '<div class="eyebrow" style="justify-content:center;margin-top:10px">YOUR OUTLIER SCORE</div>',
    '<div class="result-number gradient-text">' + fmt(score) + '</div><div class="result-max">OUT OF ' + fmt(maxScore) + ' POINTS</div>',
    arcadeRecord?.personalBest ? '<div class="arcade-new-best">✦ NEW PERSONAL BEST</div>' : '',
    '<h2 class="result-title">' + esc(tier.title) + '</h2><p class="result-description">' + esc(tier.description) + '</p>',
    '<div class="score-tiles" aria-label="Round-by-round results">' + tiles + '</div>',
    daily ? resultComparison(session.day,score) : '',
    rival ? '<div class="rival-outcome ' + (rival.won?'rival-win':rival.tied?'rival-tie':'rival-loss') + '">' +
      '<strong>⚔ ' + rival.label + '</strong><span>' + esc(rival.message) + '</span></div>' : '',
    '<div class="result-actions">',
    daily ? homeButton('COPY & CHALLENGE ↗','share','btn-primary') : session.weeklyEvent ? homeButton('SHARE WEEKLY SCORE ↗','share','btn-primary') : homeButton('GO AGAIN ↻','retry-practice','btn-primary'),
    homeButton('MY STATS →','leaderboard','btn-ghost'),
    daily ? homeButton('PRACTICE AGAIN ↻','practice','btn-ghost') : homeButton('CHANGE CATEGORY','practice','btn-ghost'),
    '</div></div>',
    '<div class="card result-modes"><div class="mode-stat rare"><span>💎 STAND OUT</span><strong>' + fmt(rareScore) + '<small> / '+fmt(rareMax)+'</small></strong>' +
      '<div class="bar-bg"><div class="bar-fg" style="width:' + (rareMax ? rareScore/rareMax*100 : 0) + '%"></div></div></div>' +
      '<div class="mode-stat fit"><span>◎ FIT IN</span><strong>' + fmt(fitScore) + '<small> / '+fmt(fitMax)+'</small></strong>' +
      '<div class="bar-bg"><div class="bar-fg" style="width:' + (fitMax ? fitScore/fitMax*100 : 0) + '%"></div></div></div></div>',
    debriefPanel(session.questions,session.answers),
    daily ? missionBoard() + playerCardPreview() : '',
    unlockedToday.length ? '<div class="card unlocked-today"><span class="eyebrow">NEW ACHIEVEMENT</span>' +
      unlockedToday.map(b=>'<div class="achievement-reveal"><span>' + esc(b.icon) + '</span><div><strong>' + esc(b.title) +
        '</strong><p>' + esc(b.detail) + '</p></div></div>').join("") + '</div>' : '',
    '<div class="card result-breakdown"><h3>Round by round</h3><p class="small muted">'+
      session.questions.filter(q=>q.type==="rare").length+' Stand Out answers · '+
      session.questions.filter(q=>q.type==="fit").length+' Fit In predictions</p>',
    breakdown,'</div>',
    daily ? '<div class="stats-strip">' + stat('DAILY GAMES',fmt(totalStats.days)) + stat('LIFETIME AVERAGE',fmt(totalStats.average)) +
      stat('LIFETIME POINTS',fmt(totalStats.total)) + stat('PERSONAL BEST',fmt(totalStats.best)) + '</div>' : '',
    daily ? '<p class="small muted text-center">NEXT DAILY GAME IN '+nextClock()+' · 00:00 UTC. Practice remains unranked.</p>' :
      '<p class="small muted text-center">Practice scores do not count toward your official daily or lifetime scores.</p>',
    '</div>'
  ].join("");
  window.scrollTo(0,0);
  if(daily){refreshResetClock();intervalId=setInterval(refreshResetClock,1000);}
}

function renderLeaderboard() {
  screen = "leaderboard";
  clearInterval(intervalId);
  const stats = lifetimeStats(storage.days);
  const todayRun = storage.days[today()];
  const dailyValue = todayRun?.complete ? scoreOf(todayRun.answers) : null;
  const boardValue = boardTab === "daily" ? dailyValue : boardTab === "average" ? stats.average : stats.total;
  const boardLabel = boardTab === "daily" ? "TODAY'S SCORE" : boardTab === "average" ? "LIFETIME DAILY AVERAGE" : "LIFETIME DAILY TOTAL";
  const histories = Object.entries(storage.days)
    .filter(([,run])=>run.complete && run.answers?.length === 7)
    .sort((a,b)=>b[0].localeCompare(a[0]))
    .slice(0,12);
  app.innerHTML = [
    '<section class="profile-wrap"><button class="back-link" type="button" data-action="home">← BACK TO GAME</button>',
    '<div class="eyebrow" style="margin:30px 0 12px">YOUR PLAYER CARD</div>',
    '<h1>KEEP <span class="gradient-text">CLIMBING.</span></h1>',
    '<p class="muted">These are your real scores saved in this browser. Global leaderboards and player accounts are planned for the next phase.</p>',
    '<div class="stats-strip">',
    stat('DAYS PLAYED',fmt(stats.days)),
    stat('BEST SCORE',fmt(stats.best)),
    stat('LIFETIME AVG',fmt(stats.average)),
    stat('TOTAL POINTS',fmt(stats.total)),
    '</div>' + progressPanel() + '<div class="board-tabs">',
    ...[['daily','DAILY SCORE'],['average','LIFETIME AVERAGE'],['total','LIFETIME TOTAL']].map(([id,label])=>
      '<button type="button" class="board-tab ' + (id===boardTab?'active':'') +
      '" data-action="board" data-board="' + id + '">' + label + '</button>'),
    '</div>',
    '<div class="card board-content"><div class="eyebrow">' + boardLabel + '</div>',
    '<div class="board-emphasis gradient-text">' + (boardValue===null ? '—' : fmt(boardValue)) + '</div>',
    '<p class="board-subtitle">' + (boardTab==='daily' ? 'Your one official attempt today, out of 7,000.' :
      boardTab==='average' ? 'Total official points divided by completed daily games. Future public ranking will require 10 completed days.' :
        'The sum of every official daily score you have earned.') + '</p>',
    '<div class="board-empty"><div class="big-icon" aria-hidden="true">🌐</div><h3>Global rankings are coming.</h3>',
    '<p class="muted small">The prototype has no server or account system yet, so it would be misleading to show a fake worldwide leaderboard.</p></div>',
    '<div class="board-note">Only official daily games count. Unlimited practice never changes these numbers. Scores are stored locally on this device, not synced between devices.</div>',
    '</div>',
    personalJourneyPanel(),
    missionBoard(),
    playerIdentityPanel(),
    seasonPanel(),
    themesPanel(),
    renderKnowledgeProfile(),
    deepKnowledgePanel(),
    badgeCabinet(),
    histories.length ? '<div class="card result-breakdown board-history"><h3>Your recent daily scores</h3>' +
      histories.map(([day,run])=>'<div class="history-row"><span>' + esc(friendlyDay(day)) +
        '</span><b>' + fmt(scoreOf(run.answers)) + ' pts</b></div>').join("") + '</div>' : '',
    '</section>'
  ].join("");
  window.scrollTo(0,0);
}

function openRules() {
  modalRoot.innerHTML = [
    '<div class="rules-modal-backdrop" data-action="close-rules"><div class="card rules-modal" role="dialog" aria-modal="true" aria-label="How to play" id="rules-dialog" tabindex="-1">',
    '<button type="button" class="modal-close" data-action="close-rules" aria-label="Close rules">×</button>',
    '<div class="eyebrow">HOW TO PLAY</div><h2 style="margin:15px 0 16px">Two ways to think.</h2>',
    '<div class="rule"><div class="rule-icon">💎</div><div><strong>Stand Out — 4 rounds</strong><p>Type a valid answer that other people might miss. The rarer the editorial ranking, the more points you earn.</p></div></div>',
    '<div class="rule"><div class="rule-icon">◎</div><div><strong>Fit In — 3 rounds</strong><p>Choose the option you think would be most popular. The top crowd choice earns 1,000 points.</p></div></div>',
    '<div class="rule"><div class="rule-icon">⏱</div><div><strong>45 seconds per question</strong><p>Lock an answer in before time runs out. Time does not change the points you earn. On Fit In rounds you can use A–F or 1–6 on a keyboard.</p></div></div>',
    '<div class="rule"><div class="rule-icon">🏅</div><div><strong>Daily milestones</strong><p>Earn personal badges and keep a streak going. Only official daily scores affect your lifetime statistics.</p></div></div>',
    '<div class="rule"><div class="rule-icon">🏆</div><div><strong>One official daily attempt</strong><p>All players receive the same seven questions each UTC day. Practice can be replayed but never counts toward official stats.</p></div></div>',
    '<p class="insight">Prototype disclaimer: Stand Out rarity scores and Fit In crowd percentages are fixed example data. This version has no live votes, global leaderboard, payment processing, or cross-device accounts.</p>',
    homeButton('GOT IT — LET ME PLAY', 'close-rules', 'btn-primary btn-wide'),
    '</div></div>'
  ].join("");
  modalRoot.querySelector("#rules-dialog")?.focus();
}
function closeRules() { modalRoot.replaceChildren(); }

function shareResult() {
  storage.beta.shared=true; saveStore();
  const link = challengeLink(window.location.href,session.day,scoreOf(session.answers));
  const value = session.weeklyEvent
    ? "OUTLIER WEEKLY SPOTLIGHT / "+session.weeklyEvent+"\n"+
      fmt(scoreOf(session.answers))+" / 10,000 points (unranked)\n"+
      "Same ten questions all week — beat my score!\n"+window.location.origin+window.location.pathname
    : shareText(session.day, session.answers) + "\nBEAT MY SCORE: " + link;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value).then(() => toast("Results copied! Challenge a friend."), () => copyFallback(value));
  } else copyFallback(value);
}
function copyFallback(value) {
  const temp = document.createElement("textarea");
  temp.value = value; temp.style.position = "fixed"; temp.style.opacity = "0";
  document.body.append(temp);temp.select();
  let worked = false;
  try { worked = document.execCommand("copy"); } catch {}
  temp.remove();
  toast(worked ? "Results copied! Challenge a friend." : "Your browser blocked copying. Try another browser.");
}

document.addEventListener("click", event => {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const action = control.dataset.action;
  if (action === "close-rules" && event.target !== control && control.classList.contains("rules-modal-backdrop")) return;
  switch (action) {
    case "home": renderHome(); break;
    case "daily": newSession("daily"); break;
    case "practice": ONLINE_ENABLED ? showOnline() : renderPracticeSelect(); break;
    case "start-practice": newSession("practice", control.dataset.group||"surprise"); break;
    case "practice-format": practiceFormat = control.dataset.format||"classic"; renderPracticeSelect(); break;
    case "retry-practice": newSession(session?.weeklyEvent?"spotlight":"practice",session?.practiceGroup||"surprise"); break;
    case "weekly-event": newSession("spotlight"); break;
    case "online": showOnline(); break;
    case "result": newSession("daily"); break;
    case "fit-answer": submitAnswer(control.dataset.answer); break;
    case "skip": submitAnswer(null); break;
    case "next": nextRound(); break;
    case "suggest-answer": {
      if(screen==="feedback"&&feedback?.question?.type==="rare") {
        const params=new URLSearchParams({
          template:"beta-feedback.yml",
          title:"[Beta] Additional valid answer for "+feedback.question.id,
          body:"Question: "+feedback.question.prompt+"\n"+
            "Suggested canonical name: \n"+
            "Why this qualifies under the specific question wording: \n"+
            "Reliable source URL: \n\n"+
            "Do not include account details, private codes or payment information."
        });
        window.open("https://github.com/dokeefe414/Outlier-Trivia/issues/new?"+params,
          "_blank","noopener,noreferrer");
      }
      break;
    }
    case "report-answer": {
      if(screen==="feedback" && feedback?.question && feedback?.rejectedGuess) {
        const params = new URLSearchParams({
          title:"Answer review: "+feedback.question.id,
          body:"Question: "+feedback.question.prompt+"\nSuggested answer: "+feedback.rejectedGuess+
            "\n\nWhy it should count (please include a reliable source):\n\n"+
            "Do not include private or payment information.\n"
        });
        window.open("https://github.com/dokeefe414/Outlier-Trivia/issues/new?"+params.toString(),"_blank","noopener,noreferrer");
      }
      break;
    }
    case "leaderboard": renderLeaderboard(); break;
    case "board": boardTab = control.dataset.board; renderLeaderboard(); break;
    case "share": shareResult(); break;
    case "rules": openRules(); break;
    case "close-rules": closeRules(); break;
    case "tour": openTour(0); break;
    case "tour-next": tourPage+1>=TOUR_STEPS.length?finishTour():openTour(tourPage+1); break;
    case "tour-prev": openTour(tourPage-1); break;
    case "tour-skip": finishTour(); break;
    case "feedback": openFeedback(); break;
    case "player-title":
    case "player-frame": {
      const part=action==="player-title"?"title":"frame";
      const desired=control.dataset.id;
      const identity=identityProgress(storage.days,{...storage.player,[part]:desired});
      if(identity[part].id!==desired)return;
      storage.player[part]=desired;
      saveStore();
      renderLeaderboard();
      toast("Player "+part+" updated: "+identity[part].name);
      break;
    }
    case "theme": {
      const desired=control.dataset.theme;
      const options=unlockableThemes(storage.days,desired);
      if(options.active!==desired)return;
      storage.theme=desired;saveStore();applyTheme();
      if(screen==="leaderboard")renderLeaderboard();else renderHome();
      toast("Theme updated: "+(THEMES.find(t=>t.id===desired)?.name||"Nebula"));
      break;
    }
    case "sound":
      storage.sound = !storage.sound; saveStore(); renderSound(); sound(720,.1);
      toast(storage.sound ? "Sound on" : "Sound off");
      break;
  }
});

document.addEventListener("input", event => {
  if(event.target?.id === "rare-answer") {
    const warning = document.getElementById("answer-validation");
    if (warning) warning.hidden = true;
    event.target.removeAttribute("aria-invalid");
    return;
  }
  if(event.target?.id !== "answer-explorer-filter") return;
  const needle=normalizeAnswer(event.target.value);
  let shown=0;
  document.querySelectorAll(".explorer-row").forEach(row => {
    const visible=row.dataset.search.includes(needle);
    row.hidden=!visible;
    if(visible)shown++;
  });
  const empty=document.getElementById("answer-explorer-empty");
  if(empty)empty.hidden=shown>0;
});

document.addEventListener("submit", event => {
  if (event.target?.id !== "rare-form") return;
  event.preventDefault();
  const text = document.getElementById("rare-answer")?.value.trim();
  if (text) submitAnswer(text);
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (modalRoot.firstElementChild) {
      if(modalRoot.querySelector("#tour-dialog")) finishTour();
      else closeRules();
      return;
    }
  }
  if (modalRoot.firstElementChild || screen !== "game" || currentQuestion()?.type !== "fit") return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
  if (event.target instanceof Element && event.target.closest("input,textarea,select,[contenteditable]")) return;
  const key = event.key.toUpperCase();
  const index = "ABCDEF".indexOf(key);
  const numberIndex = "123456".indexOf(key);
  const chosen = index >= 0 ? index : numberIndex;
  if (chosen >= 0) {
    const option = document.querySelectorAll('.fit-option')[chosen];
    if (option) { event.preventDefault(); option.click(); }
  }
});

renderHome();
renderSound();
applyTheme();
if(!storage.beta.tutorial && completedDailyCount(storage.days)===0 && !tourWasSeenThisSession &&
    new URLSearchParams(window.location.search).get("online")!=="1") {
  openTour(0);
}
const onlineNav = document.getElementById("online-nav");
if (onlineNav && ONLINE_ENABLED) onlineNav.hidden = false;
if (ONLINE_ENABLED && new URLSearchParams(window.location.search).get("online") === "1") showOnline();
