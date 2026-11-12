import { rareQuestions, fitQuestions, DAILY_PATTERN } from "./data.js";

export const QUESTION_SECONDS = 45;
export const MAX_SCORE = 7000;

export function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function normalizeAnswer(value) {
  return String(value ?? "")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " and ")
    .replace(/[^a-z0-9]/g, "");
}

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

export function buildRound(day = utcDay(), practice = false) {
  const broad = rareQuestions.filter(question => question.bigPool);
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
  const query = normalizeAnswer(rawAnswer);
  if (!query) return null;
  const possibilities = question.answers.flatMap(([label, points, aliases = []]) =>
    [label, ...aliases].map(text => ({ key: normalizeAnswer(text), label, points }))
  );
  const exact = possibilities.find(item => item.key === query);
  if (exact) return exact;

  // Forgive one missing, extra or wrong character in long answers,
  // but only if it clearly maps to ONE canonical answer.
  if (query.length < 5) return null;
  const candidates = possibilities
    .filter(item => Math.abs(item.key.length - query.length) <= 1 && editDistance(item.key, query) === 1);
  const unique = [...new Set(candidates.map(item => item.label))];
  return unique.length === 1 ? candidates[0] : null;
}

export function evaluate(question, response) {
  if (question.type === "rare") {
    const found = matchRare(question, response);
    return {
      questionId: question.id,
      type: "rare",
      category: question.category,
      response: String(response ?? "").slice(0, 80),
      accepted: found?.label ?? null,
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
