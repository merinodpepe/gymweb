import { addDays, dayNumber, isoWeekStart } from "./weeks";

export const HEATMAP_WEEKS = 26;

export interface Consistency {
  /** Consecutive ISO weeks with at least one workout; this week may still be empty. */
  current_streak: number;
  longest_streak: number;
  workouts_this_week: number;
  /** Workout days per week since the first workout. */
  avg_per_week: number;
  /** % of weeks since the first workout with at least one workout. */
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

  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const w of [...byWeek.keys()].sort()) {
    run = prev !== null && addDays(prev, 7) === w ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = w;
  }

  let current = 0;
  for (let w = byWeek.has(weekStart) ? weekStart : addDays(weekStart, -7); byWeek.has(w); w = addDays(w, -7)) current++;

  const weeksTracked = days.length ? Math.round((dayNumber(weekStart) - dayNumber(isoWeekStart(days[0]))) / 7) + 1 : 0;
  const set = new Set(days);
  const heatmap = Array.from({ length: HEATMAP_WEEKS }, (_, i) => {
    const start = addDays(weekStart, -7 * (HEATMAP_WEEKS - 1 - i));
    return { week_start: start, days: Array.from({ length: 7 }, (_, d) => set.has(addDays(start, d))) };
  });

  return {
    current_streak: current,
    longest_streak: longest,
    workouts_this_week: byWeek.get(weekStart) ?? 0,
    avg_per_week: weeksTracked ? Math.round((days.length / weeksTracked) * 10) / 10 : 0,
    score: weeksTracked ? Math.round((byWeek.size / weeksTracked) * 100) : 0,
    total_workouts: days.length,
    heatmap,
  };
}
