// Local-only player progression. This is for motivation and personal history,
// not a verified public rank. Every calculation uses completed official days.
import { scoreOf } from "./game.js";

function isComplete(run) {
  return Boolean(run?.complete && Array.isArray(run.answers) && run.answers.length === 7);
}
function priorDay(day, offset) {
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

export function activityWeek(days, today) {
  return Array.from({length: 7}, (_, index) => {
    const day = priorDay(today, 6 - index);
    const run = days?.[day];
    return { day, complete: isComplete(run), score: isComplete(run) ? scoreOf(run.answers) : null };
  });
}

export function currentStreak(days, today) {
  // Missing today's game is okay until UTC midnight; start with yesterday.
  let offset = isComplete(days?.[today]) ? 0 : 1;
  let streak = 0;
  while (isComplete(days?.[priorDay(today, offset)])) {
    streak++;
    offset++;
    if (streak > 10000) break;
  }
  return streak;
}

export function longestStreak(days) {
  const completed = Object.keys(days ?? {}).filter(day => isComplete(days[day])).sort();
  let longest = 0, current = 0, previous = null;
  for (const day of completed) {
    current = previous && priorDay(day, 1) === previous ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }
  return longest;
}

export const BADGES = [
  { id:"first", icon:"✦", title:"First Spark", detail:"Finish your first official daily game." },
  { id:"three", icon:"🔥", title:"On a Roll", detail:"Complete official games three days in a row." },
  { id:"seven", icon:"⚡", title:"Unstoppable", detail:"Play seven consecutive days." },
  { id:"twenty", icon:"🌍", title:"Worldly Mind", detail:"Finish 20 official daily games." },
  { id:"fivek", icon:"👑", title:"High Flyer", detail:"Score at least 5,000 in a daily game." },
  { id:"perfect", icon:"🎯", title:"Clean Sweep", detail:"Get all seven daily questions right." },
  { id:"diamond", icon:"💎", title:"Deep Cut", detail:"Earn at least 950 points on one Stand Out answer." },
  { id:"mindreader", icon:"◎", title:"Mind Reader", detail:"Pick the top answer on all three Fit In questions in a day." }
];

export function earnedBadges(days) {
  const completed = Object.values(days ?? {}).filter(isComplete);
  const totals = completed.map(run => scoreOf(run.answers));
  const bestStreak = longestStreak(days);
  const earned = new Set();
  if (completed.length >= 1) earned.add("first");
  if (bestStreak >= 3) earned.add("three");
  if (bestStreak >= 7) earned.add("seven");
  if (completed.length >= 20) earned.add("twenty");
  if (totals.some(score => score >= 5000)) earned.add("fivek");
  if (completed.some(run => run.answers.every(answer => answer.valid))) earned.add("perfect");
  if (completed.some(run => run.answers.some(answer => answer.type === "rare" && answer.points >= 950))) earned.add("diamond");
  if (completed.some(run => {
    const fit = run.answers.filter(answer => answer.type === "fit");
    return fit.length === 3 && fit.every(answer => answer.points === 1000);
  })) earned.add("mindreader");
  return BADGES.map(badge => ({...badge, earned: earned.has(badge.id)}));
}

export function recentBadges(days, previousDays) {
  const previous = new Set(earnedBadges(previousDays).filter(b=>b.earned).map(b=>b.id));
  return earnedBadges(days).filter(b => b.earned && !previous.has(b.id));
}
