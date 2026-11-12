import { buildRound, buildLegacyRound, utcDay, normalizeAnswer, evaluate, scoreOf, getTier, lifetimeStats, shareText, shuffled, randomFromSeed, seedFromString, practiceCategoryOptions, buildArcadeRound, arcadeFormats, arcadeMaximum, QUESTION_SECONDS, MAX_SCORE } from "./game.js";
import { rareQuestions, fitQuestions } from "./data.js";
import { activityWeek, currentStreak, longestStreak, earnedBadges } from "./progression.js";
import { ONLINE_ENABLED } from "./online-config.js";
import {scoreHistory,weekSummary,nextGoal,versusHistory,utcResetRemaining} from "./journey.js";
import { readFriendChallenge, challengeLink, challengeOutcome, categoryInsights } from "./social.js";

const STORAGE_KEY = "outlier-prototype-v1";
const app = document.getElementById("app");
const toastNode = document.getElementById("toast");
const modalRoot = document.getElementById("modal-root");

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { days: raw.days && typeof raw.days === "object" ? raw.days : {},
      arcade: raw.arcade && typeof raw.arcade === "object" ? raw.arcade : {},
      sound: Boolean(raw.sound) };
  } catch {
    return { days: {}, arcade: {}, sound: false };
  }
}
const storage = loadStore();
let screen = "home";
let session = null;
let feedback = null;
let boardTab = "daily";
let practiceFormat = "classic";
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
function renderHome() {
  screen = "home";
  clearInterval(intervalId);
  const record = storage.days[today()];
  const stats = lifetimeStats(storage.days);
  const played = Boolean(record?.complete);
  const started = Boolean(record?.answers?.length || record?.deadline);
  const action = ONLINE_ENABLED ? "online" : played ? "result" : "daily";
  const actionLabel = ONLINE_ENABLED ? "COMPETE ONLINE TODAY →" : played ? "VIEW TODAY'S RESULTS ↗" : started ? "CONTINUE TODAY'S GAME →" : "PLAY TODAY'S GAME →";
  app.innerHTML = [
    '<section class="hero"><div class="hero-copy">',
    '<div class="eyebrow">THE DAILY BRAIN BATTLE</div>',
    '<h1>THINK <span class="gradient-text">OUTSIDE</span><br>THE CROWD.</h1>',
    '<p class="hero-description">Seven questions. Two ways to win. Think of an answer from a massive knowledge pool, or predict the crowd\'s favorite. How different is your brain?</p>',
    '<div class="hero-actions">',
    homeButton(actionLabel, action), ONLINE_ENABLED ?
      homeButton("PLAY FREE AS GUEST", "daily", "btn-ghost") :
      homeButton("TRY PRACTICE MODE", "practice", "btn-ghost"),
    '</div>' + (friendChallenge && friendChallenge.current ?
      '<div class="friend-challenge"><div class="friend-burst">⚔</div><div><strong>A FRIEND CHALLENGED YOU!</strong><p>Beat their ' + fmt(friendChallenge.score) +
      '-point score on today\'s seven questions.</p></div></div>' :
      friendChallenge ? '<div class="friend-challenge expired"><div class="friend-burst">◷</div><div><strong>THIS CHALLENGE HAS EXPIRED</strong><p>That shared score was from a different day. Play today\'s new questions instead.</p></div></div>' : '') +
    '<div class="play-info"><span>✦ <b>Free</b> daily game</span><span>◷ About <b>3 minutes</b></span><span>◇ <b>4 rare + 3 crowd</b> picks</span></div>',
    '</div><div class="orbit-scene" aria-hidden="true">',
    '<div class="orbit-ring"></div><div class="orbit-ring two"></div><div class="orbit-ball"></div>',
    '<div class="orbit-card top"><span class="card-symbol">💎</span><strong>+980 PTS</strong><small>STAND OUT · DEEP CUT</small></div>',
    '<div class="orbit-card bottom"><span class="card-symbol">◎</span><strong>42% AGREE</strong><small>FIT IN · CROWD FAVORITE</small></div>',
    '<div class="orbit-particle one"></div><div class="orbit-particle two"></div></div></section>',
    '<section class="home-bottom"><div class="section-heading"><div><div class="eyebrow" style="margin-bottom:12px">YOUR DAILY FIX</div><h2>One game. Two mindsets.</h2></div>',
    '<span class="pill pill-yellow">NEW QUESTIONS EVERY DAY</span></div>',
    '<div class="feature-grid">',
    '<div class="card feature-card"><span class="feature-tail">4</span><span class="feature-icon">💎</span><span class="pill pill-purple">4 QUESTIONS</span><h3>STAND OUT</h3><p>Name a correct answer other people might overlook. The deeper the cut, the bigger your score.</p></div>',
    '<div class="card feature-card"><span class="feature-tail">3</span><span class="feature-icon">◎</span><span class="pill pill-teal">3 QUESTIONS</span><h3>FIT IN</h3><p>Choose what you think the crowd would pick. Here, the most popular answer wins.</p></div>',
    '<div class="card feature-card"><span class="feature-tail">↗</span><span class="feature-icon">🏆</span><span class="pill pill-yellow">CLIMB THE RANKS</span><h3>PLAY THE LONG GAME</h3><p>Build a daily streak and chase your lifetime average and total. Global boards come next.</p></div>',
    '</div>',
    '<div class="stats-strip">',
    stat("CURRENT STREAK", currentStreak(storage.days,today()) + " 🔥"),
    stat("LIFETIME AVERAGE", fmt(stats.average)),
    stat("LIFETIME POINTS", fmt(stats.total)),
    stat("PERSONAL BEST", fmt(stats.best)),
    '</div>' + progressPanel() + journeyPreview() + '</section>',
    '<section class="promo"><div><span class="pill pill-purple" style="margin-bottom:13px">' +
      (ONLINE_ENABLED ? 'ONLINE LEAGUE' : 'COMING AFTER THE PROTOTYPE') + '</span>',
    '<h3>More trivia. No more waiting.</h3><p>' + (ONLINE_ENABLED ?
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
  app.innerHTML='<section class="practice-select">' +
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
    '<div class="answer-row"><input id="rare-answer" class="answer-input" name="answer" type="text" maxlength="80" placeholder="Type your answer..." required spellcheck="false" autocapitalize="words">' +
    '<button class="btn btn-primary" type="submit">LOCK IT IN →</button></div></form>';
  app.innerHTML = [
    '<div class="game-wrap"><div class="topbar"><button class="back-link" data-action="home" type="button">← BACK TO HOME</button>',
    '<span class="session-pill">' + (session.mode === "daily" ? 'DAILY · ' + esc(session.day) : "PRACTICE · " + esc((session.practiceGroup||"surprise").toUpperCase())) + '</span></div>',
    '<div class="game-head"><div><div class="eyebrow" style="margin-bottom:10px">THE CHALLENGE</div>',
    '<h2>Question ' + (session.index + 1) + ' <span class="muted">/ ' +session.questions.length+'</span></h2><p>Every answer counts. Trust your instincts.</p></div>',
    '<div class="game-score"><div class="tiny muted">YOUR SCORE</div><strong>' + fmt(scoreOf(session.answers)) + '</strong></div></div>',
    '<div class="progress-track"><div class="progress-fill" style="width:' + (session.index/7*100) + '%"></div></div>',
    roundDots(),'<article class="card question-card ' + q.type + '">',
    '<div class="question-head"><span class="pill ' + (fit ? "pill-teal" : "pill-purple") + '">' + (fit ? "◎ FIT IN — MATCH THE CROWD" : "✦ STAND OUT — BE THE EXCEPTION") + '</span>',
    '<div id="timer" class="timer" aria-label="Time remaining">0:45</div></div>',
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
  clearInterval(intervalId);
  const q = currentQuestion();
  feedback = { question:q, result:evaluate(q,value), number:session.index+1 };
  session.answers.push(feedback.result);
  session.deadline = null;
  saveDaily();
  sound(feedback.result.points > 0 ? 580 : 220, .14);
  renderFeedback();
}

function feedbackHeading(result) {
  if (!result.valid) return { title:"NO POINTS THIS TIME", icon:"⌛", description:"No accepted answer was locked in. Tomorrow is another shot." };
  if (result.type === "fit") {
    if (result.points === 1000) return { title:"CROWD MIND READER!", icon:"◎", description:"You found the most popular answer in our prototype crowd board." };
    if (result.points >= 500) return { title:"YOU KNOW THE CROWD!", icon:"◉", description:"A strong prediction — you were thinking with the majority." };
    return { title:"DIFFERENT WAVELENGTH!", icon:"◌", description:"Sometimes your instincts are more unusual than the crowd." };
  }
  if (result.points >= 850) return { title:"ABSOLUTE OUTLIER!", icon:"💎", description:"That is a seriously deep cut. Very few would think of that." };
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
  const info = feedbackHeading(result);
  const fit = q.type === "fit";
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
    '<div class="feedback-points gradient-text">+' + fmt(result.points) + '</div>',
    '<div class="feedback-name">' + esc(result.accepted || (result.response ? '"' + result.response + '" — not in the approved answer set' : 'No answer submitted')) + '</div>',
    '<p class="small">' + info.description + '</p>',
    '<span class="pill pill-yellow">TOTAL ' + fmt(scoreOf(session.answers)) + ' PTS</span></div>',
    '<div class="feedback-divider"></div>',
    '<div class="feedback-subhead">' + (fit ? 'THE PROTOTYPE CROWD BOARD' : 'SOME OF THE RAREST ACCEPTED ANSWERS') + '</div>',
    fit ? topScore : '<div class="answer-chips">' + topScore + '</div>',
    answerExplorer(q),
    (!result.valid && !fit && result.response) ?
      '<div class="answer-report"><span>Think your answer should count?</span>'+
      homeButton('REQUEST AN ANSWER REVIEW ↗','report-answer','btn-outline')+'</div>' : '',
    '<p class="insight">' + (fit ?
      'These percentages are fixed example values for the prototype, NOT survey data or live player votes. Everyone gets the same score for the same pick.' :
      'Stand Out scores are curated prototype rarity tiers, NOT actual frequencies from other players. Answers are checked against a finite validated list.') + '</p>',
    homeButton(feedback.number===session.questions.length ? 'SEE MY FINAL RESULTS →' : 'NEXT QUESTION →', "next", fit ? "btn-teal btn-wide feedback-next" : "btn-primary btn-wide feedback-next"),
    '</article></div>'
  ].join("");
  window.scrollTo(0,0);
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
    const key=(session.practiceFormat||"classic")+":"+(session.practiceGroup||"surprise");
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
    '<span class="session-pill">' + (daily ? 'DAILY FINISHED' : 'PRACTICE FINISHED · UNRANKED') + '</span></div>',
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
    daily ? homeButton('COPY & CHALLENGE ↗','share','btn-primary') : homeButton('GO AGAIN ↻','retry-practice','btn-primary'),
    homeButton('MY STATS →','leaderboard','btn-ghost'),
    daily ? homeButton('PRACTICE AGAIN ↻','practice','btn-ghost') : homeButton('CHANGE CATEGORY','practice','btn-ghost'),
    '</div></div>',
    '<div class="card result-modes"><div class="mode-stat rare"><span>💎 STAND OUT</span><strong>' + fmt(rareScore) + '<small> / '+fmt(rareMax)+'</small></strong>' +
      '<div class="bar-bg"><div class="bar-fg" style="width:' + (rareMax ? rareScore/rareMax*100 : 0) + '%"></div></div></div>' +
      '<div class="mode-stat fit"><span>◎ FIT IN</span><strong>' + fmt(fitScore) + '<small> / '+fmt(fitMax)+'</small></strong>' +
      '<div class="bar-bg"><div class="bar-fg" style="width:' + (fitMax ? fitScore/fitMax*100 : 0) + '%"></div></div></div></div>',
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
    renderKnowledgeProfile(),
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
  const link = challengeLink(window.location.href,session.day,scoreOf(session.answers));
  const value = shareText(session.day, session.answers) + "\nBEAT MY SCORE: " + link;
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
    case "retry-practice": newSession("practice",session?.practiceGroup||"surprise"); break;
    case "online": showOnline(); break;
    case "result": newSession("daily"); break;
    case "fit-answer": submitAnswer(control.dataset.answer); break;
    case "skip": submitAnswer(null); break;
    case "next": nextRound(); break;
    case "report-answer": {
      if(screen==="feedback" && feedback?.question && feedback?.result?.response) {
        const params = new URLSearchParams({
          title:"Answer review: "+feedback.question.id,
          body:"Question: "+feedback.question.prompt+"\nSuggested answer: "+feedback.result.response+
            "\n\nWhy it should count (please include a reliable source):\n\n"
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
    case "sound":
      storage.sound = !storage.sound; saveStore(); renderSound(); sound(720,.1);
      toast(storage.sound ? "Sound on" : "Sound off");
      break;
  }
});

document.addEventListener("input", event => {
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
    if (modalRoot.firstElementChild) { closeRules(); return; }
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
const onlineNav = document.getElementById("online-nav");
if (onlineNav && ONLINE_ENABLED) onlineNav.hidden = false;
if (ONLINE_ENABLED && new URLSearchParams(window.location.search).get("online") === "1") showOnline();
