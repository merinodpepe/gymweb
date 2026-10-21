import { addDays, dayNumber, isoWeekStart } from "./weeks";

export const HEATMAP_WEEKS = 26;

/** Workouts that make a week count (100%): 3 before `TARGET_RAISED_FROM`, 4 from that Monday on. */
export const WEEKLY_TARGET = 3;
export const RAISED_WEEKLY_TARGET = 4;
export const TARGET_RAISED_FROM = "2026-10-19";

export function weeklyTarget(weekStart: string): number {
  return weekStart >= TARGET_RAISED_FROM ? RAISED_WEEKLY_TARGET : WEEKLY_TARGET;
}

export interface Consistency {
  /** Consecutive ISO weeks that reached the weekly target; this week may still be empty. */
  current_streak: number;
  longest_streak: number;
  workouts_this_week: number;
  /** Workouts that make this week 100%. */
  target_this_week: number;
  /** Workout days per week since the first workout. */
  avg_per_week: number;
  /** Average weekly completion %: each week since the first workout is min(workouts / target, 1). The current week only counts once complete. */
  score: number;
  total_workouts: number;
  /** Monday of each week, oldest first, with the workout days (0 = Monday) of each. */
  heatmap: { week_start: string; days: boolean[] }[];
}

/** `dates`: any workout timestamps (`YYYY-MM-DD…`); several in one day count once. */
export function consistency(dates: readonly string[], today: string): Consistency {
  const days = [...new Set(dates.map((d) => d.slice(0, 10)).filter((d) => d <= today))].sort();
  const weekStart = isoWeekStart(today);
  const byWeek = new Map<string, number>();
  for (const d of days) byWeek.set(isoWeekStart(d), (byWeek.get(isoWeekStart(d)) ?? 0) + 1);

  const met = (w: string) => (byWeek.get(w) ?? 0) >= weeklyTarget(w);
  const metWeeks = [...byWeek.keys()].filter(met).sort();

  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const w of metWeeks) {
    run = prev !== null && addDays(prev, 7) === w ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = w;
  }

  let current = 0;
  for (let w = met(weekStart) ? weekStart : addDays(weekStart, -7); met(w); w = addDays(w, -7)) current++;

  const weeksTracked = days.length ? Math.round((dayNumber(weekStart) - dayNumber(isoWeekStart(days[0]))) / 7) + 1 : 0;
  const pct = (w: string) => Math.min(1, (byWeek.get(w) ?? 0) / weeklyTarget(w));
  const scored = Array.from({ length: weeksTracked }, (_, i) => addDays(weekStart, -7 * i)).filter((w) => w !== weekStart || met(w));
  const pcts = (scored.length ? scored : [weekStart]).map(pct);
  const score = weeksTracked ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 100) : 0;
  const set = new Set(days);
  const heatmap = Array.from({ length: HEATMAP_WEEKS }, (_, i) => {
    const start = addDays(weekStart, -7 * (HEATMAP_WEEKS - 1 - i));
    return { week_start: start, days: Array.from({ length: 7 }, (_, d) => set.has(addDays(start, d))) };
  });

  return {
    current_streak: current,
    longest_streak: longest,
    workouts_this_week: byWeek.get(weekStart) ?? 0,
    target_this_week: weeklyTarget(weekStart),
    avg_per_week: weeksTracked ? Math.round((days.length / weeksTracked) * 10) / 10 : 0,
    score,
    total_workouts: days.length,
    heatmap,
  };
}
