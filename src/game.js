import { normalizeAnswer as normalized, inspectRareGuess, rarityTier } from "./answer-intelligence.js";
import { rareQuestions, fitQuestions, DAILY_PATTERN } from "./data.js";

export const QUESTION_SECONDS = 45;
export const MAX_SCORE = 7000;

export function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function normalizeAnswer(value) { return normalized(value); }

export function seedFromString(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randomFromSeed(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildLegacyRound(day = utcDay()) {
  // Compatibility for daily attempts started under prototype v0.1.
  const random = randomFromSeed(seedFromString("outlier-v1:" + day));
  const rare = shuffled(rareQuestions.slice(0, 16), random).slice(0, 4);
  const fit = shuffled(fitQuestions.slice(0, 14), random).slice(0, 3);
  return DAILY_PATTERN.map((type, index) => ({
    ...((type === "rare") ? rare.shift() : fit.shift()), type, index
  }));
}

export function weekStart(day = utcDay()) {
  const date = new Date(day + "T00:00:00Z");
  const weekday = (date.getUTCDay() + 6) % 7; // Monday = 0.
  date.setUTCDate(date.getUTCDate() - weekday);
  return date.toISOString().slice(0, 10);
}

export function buildAtlasRound(day = utcDay(), practice = false) {
  const broad = rareQuestions.filter(question => question.bigPool && (practice || !question.arcadeOnly));
  const geoPool = broad.filter(question => question.poolGroup === "geo");
  const sciencePool = broad.filter(question => question.poolGroup === "science");
  const wildPool = broad.filter(question => question.poolGroup === "wild");
  if (geoPool.length < 14 || sciencePool.length < 7 || wildPool.length < 7 || fitQuestions.length < 21) {
    throw new Error("Expanded daily bank is too small for a full no-repeat week");
  }
  let rare;
  let fit;
  if (practice) {
    rare = [
      ...shuffled(geoPool, Math.random).slice(0, 2),
      shuffled(sciencePool, Math.random)[0],
      shuffled(wildPool, Math.random)[0],
    ];
    rare = shuffled(rare, Math.random);
    fit = shuffled(fitQuestions, Math.random).slice(0, 3);
  } else {
    const monday = weekStart(day);
    const dayIndex = Math.round((Date.parse(day + "T00:00:00Z") - Date.parse(monday + "T00:00:00Z")) / 86400000);
    if (dayIndex < 0 || dayIndex > 6) throw new Error("Invalid UTC day for weekly schedule");
    const seed = randomFromSeed(seedFromString("outlier-atlas-v1:" + monday));
    const geography = shuffled(geoPool, seed).slice(dayIndex * 2, dayIndex * 2 + 2);
    const science = shuffled(sciencePool, seed)[dayIndex];
    const wildcard = shuffled(wildPool, seed)[dayIndex];
    rare = shuffled([...geography, science, wildcard], randomFromSeed(seedFromString("outlier-atlas-day:" + day)));
    fit = shuffled(fitQuestions, seed).slice(dayIndex * 3, dayIndex * 3 + 3);
  }
  return DAILY_PATTERN.map((type, index) => ({
    ...((type === "rare") ? rare.shift() : fit.shift()), type, index
  }));
}


// v0.5 official schedule. The older atlas schedule is retained for games
// dated <= 2026-11-12, preserving the last v0.4 launch day.
export const dailyCategorySchedule = Object.freeze([
  ["geo","movies","animals","sports"],
  ["science","tv","music","food"],
  ["wild","games","history","people"],
  ["geo","movies","music","animals"],
  ["science","tv","sports","games"],
  ["wild","food","people","history"],
  ["geo","music","sports","animals"]
]);
export const practiceCategoryOptions = Object.freeze([
  {value:"surprise",label:"SURPRISE MIX",icon:"✦",detail:"A balanced mix of everything"},
  {value:"geo",label:"GEOGRAPHY",icon:"🌍",detail:"Countries, places and capitals"},
  {value:"science",label:"SCIENCE",icon:"⚛",detail:"Chemistry and elements"},
  {value:"movies",label:"MOVIES",icon:"🎬",detail:"Classic and popular films"},
  {value:"tv",label:"TELEVISION",icon:"📺",detail:"Series and show titles"},
  {value:"music",label:"MUSIC",icon:"🎵",detail:"Performers, styles and instruments"},
  {value:"sports",label:"SPORTS",icon:"🏀",detail:"Teams, leagues and MVPs"},
  {value:"animals",label:"ANIMALS",icon:"🐾",detail:"Wildlife, birds and dog breeds"},
  {value:"food",label:"FOOD",icon:"🍉",detail:"Fruits and vegetables"},
  {value:"games",label:"GAMING",icon:"🎮",detail:"Pokémon and board games"},
  {value:"history",label:"HISTORY",icon:"🏛",detail:"Scientists and mythology"},
  {value:"people",label:"PEOPLE",icon:"🎤",detail:"Famous entertainers"},
  {value:"wild",label:"CLASSIC TRIVIA",icon:"🧠",detail:"Languages, national parks, USA"}
]);
function groupQuestions(group,forOfficial=false) {
  return rareQuestions.filter(q => q.bigPool && q.poolGroup === group &&
    (!forOfficial || !q.arcadeOnly));
}
export function buildRound(day = utcDay(), practice = false, practiceGroup = "surprise") {
  if (!practice && day <= "2026-11-12") return buildAtlasRound(day,false);
  const allGroups = [...new Set(practiceCategoryOptions.map(c=>c.value).filter(x=>x!=="surprise"))];
  if (practice) {
    let rare;
    if (practiceGroup === "surprise" || !allGroups.includes(practiceGroup)) {
      const groupNames = shuffled(allGroups,Math.random).slice(0,4);
      rare=groupNames.map(group=>{
        const q=shuffled(groupQuestions(group),Math.random)[0];
        if(!q)throw new Error("Missing practice questions in "+group);
        return q;
      });
    } else {
      rare=shuffled(groupQuestions(practiceGroup),Math.random).slice(0,4);
    }
    if(rare.length !== 4 || new Set(rare.map(q=>q.id)).size !== 4) throw new Error("Invalid practice slate");
    const fit=shuffled(fitQuestions,Math.random).slice(0,3);
    return DAILY_PATTERN.map((type,index)=>({
      ...(type==="rare" ? rare.shift() : fit.shift()),type,index
    }));
  }
  const monday=weekStart(day);
  const dayIndex=Math.round((Date.parse(day+"T00:00:00Z")-Date.parse(monday+"T00:00:00Z"))/86400000);
  if(dayIndex<0 || dayIndex>6)throw new Error("Invalid UTC day");
  const groups=dailyCategorySchedule[dayIndex];
  const rare=groups.map((group)=>{
    const occurrence=dailyCategorySchedule.slice(0,dayIndex).flat().filter(x=>x===group).length;
    const pool=shuffled(groupQuestions(group,true),randomFromSeed(seedFromString("outlier-v05-week:"+monday+"|"+group)));
    const selected=pool[occurrence];
    if(!selected)throw new Error("Not enough "+group+" questions for a full week");
    return selected;
  });
  const order=shuffled(rare,randomFromSeed(seedFromString("outlier-v05-order:"+day)));
  const fit=shuffled(fitQuestions,randomFromSeed(seedFromString("outlier-v05-fit:"+monday))).slice(dayIndex*3,dayIndex*3+3);
  if(fit.length!==3)throw new Error("Need at least 21 Fit In prompts per week");
  return DAILY_PATTERN.map((type,index)=>({
    ...(type==="rare" ? order.shift() : fit.shift()),type,index
  }));
}


// Standalone practice formats. Official daily gameplay always remains seven
// questions and is deliberately NOT influenced by these settings.
export const arcadeFormats = Object.freeze([
  {value:"classic",title:"CLASSIC",icon:"✦",rounds:7,seconds:45,description:"The original 4 rare + 3 crowd challenge"},
  {value:"quick",title:"QUICK HIT",icon:"⚡",rounds:3,seconds:35,description:"Two rare picks and one crowd prediction"},
  {value:"rare-rush",title:"RARE RUSH",icon:"💎",rounds:10,seconds:30,description:"Ten rare-answer challenges. No crowd questions."},
]);

export function buildArcadeRound(day=utcDay(), group="surprise", format="classic", random=Math.random) {
  if (format === "classic") return buildRound(day,true,group);
  if (!["quick","rare-rush"].includes(format)) throw new Error("Unknown practice format");
  const category = practiceCategoryOptions.some(c=>c.value===group) ? group : "surprise";
  const all = rareQuestions.filter(q=>q.bigPool);
  const categoryPool = category === "surprise" ? all : groupQuestions(category);
  if (!categoryPool.length) throw new Error("No prompts available");
  if (format === "quick") {
    const rare = shuffled(categoryPool,random).slice(0,2);
    const fit=shuffled(fitQuestions,random).slice(0,1);
    if (rare.length!==2 || fit.length!==1) throw new Error("Insufficient quick-play content");
    return [{...rare[0],type:"rare",index:0},{...fit[0],type:"fit",index:1},{...rare[1],type:"rare",index:2}];
  }
  // Mix the selected topic with additional categories so every Rare Rush
  // can offer ten distinct prompts even if a topic has only 4-6 questions.
  const focus=shuffled(categoryPool,random).slice(0,Math.min(6,categoryPool.length));
  const used=new Set(focus.map(x=>x.id));
  const remaining=shuffled(all.filter(x=>!used.has(x.id)),random);
  const chosen=[...focus,...remaining.slice(0,10-focus.length)];
  if (chosen.length!==10 || new Set(chosen.map(x=>x.id)).size!==10)
    throw new Error("Insufficient Rare Rush prompts");
  return shuffled(chosen,random).map((q,index)=>({...q,type:"rare",index}));
}

// Free unranked Big List mode: seven archive-backed open-answer prompts.
export function buildOpenAtlasRound(random=Math.random) {
  const pool=rareQuestions.filter(q=>q.arcadeOnly&&q.bigPool);
  if(pool.length<7)throw new Error("Insufficient open-atlas questions");
  return shuffled(pool,random).slice(0,7).map((q,index)=>({...q,type:"rare",index}));
}

export function arcadeMaximum(questions) {
  return questions.length*1000;
}


export function editDistance(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let last = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        last + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      last = old;
    }
  }
  return previous[b.length];
}

export function matchRare(question, rawAnswer) {
  return inspectRareGuess(question, rawAnswer).match;
}
export { inspectRareGuess, rarityTier };

export function evaluate(question, response) {
  if (question.type === "rare") {
    const found = matchRare(question, response);
    return {
      questionId: question.id,
      type: "rare",
      category: question.category,
      response: String(response ?? "").slice(0, 80),
      accepted: found?.label ?? null,
      matchKind: found?.matchKind ?? null,
      points: found?.points ?? 0,
      valid: Boolean(found),
    };
  }
  const choice = question.choices.find(([name]) => name === response);
  const maxShare = Math.max(...question.choices.map(([, share]) => share));
  return {
    questionId: question.id,
    type: "fit",
    category: question.category,
    response: choice?.[0] ?? "",
    accepted: choice?.[0] ?? null,
    points: choice ? Math.round((choice[1] / maxShare) * 1000) : 0,
    share: choice?.[1] ?? null,
    valid: Boolean(choice),
  };
}

export function scoreOf(answers) {
  return answers.reduce((sum, answer) => sum + (answer.points ?? 0), 0);
}

export function getTier(score) {
  if (score >= 5700) return { title: "THE OUTLIER", description: "You're impossible to predict. The crowd can't keep up." };
  if (score >= 4400) return { title: "BIG BRAIN ENERGY", description: "You see patterns other people miss." };
  if (score >= 2900) return { title: "SHARP THINKER", description: "A strong run. Come back and level up tomorrow." };
  return { title: "WARMING UP", description: "The best brains are built one question at a time." };
}

export function lifetimeStats(completedByDay) {
  const entries = Object.entries(completedByDay ?? {})
    .filter(([, value]) => value?.complete && Array.isArray(value.answers) && value.answers.length === 7);
  const totals = entries.map(([, value]) => scoreOf(value.answers));
  const total = totals.reduce((sum, value) => sum + value, 0);
  const best = totals.length ? Math.max(...totals) : 0;
  const days = entries.length;
  return {
    days, total, best,
    average: days ? Math.round(total / days) : 0,
  };
}

export function shareText(day, answers) {
  const icons = answers.map(answer => {
    if (!answer.valid) return "⬛";
    if (answer.points >= 800) return "🟪";
    if (answer.points >= 500) return "🟩";
    return "🟨";
  }).join("");
  return [
    "OUTLIER / " + day,
    icons,
    scoreOf(answers).toLocaleString("en-US") + " / 7,000 points",
    "4 Stand Out · 3 Fit In",
    "Can you outthink the crowd?",
  ].join("\n");
}
