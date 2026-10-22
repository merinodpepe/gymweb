import { tonnage } from "../stats/volume";
import { type DatedValue } from "../stats/ewma";
import { summarizeRuns, type RunLike } from "../stats/pace";
import { mean, median, quantile } from "../stats/util";
import { addDays, isoWeekStart } from "../stats/weeks";
import type { InsightSession } from "./data";
import type { Surface } from "../schemas/run";

const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

// ---------------------------------------------------------------- 1. calendar with volume

export interface CalendarDay {
  date: string;
  day: number;
  /** Tonnage of the day (null = no workout). */
  tonnage: number | null;
  /** 0 = rest day, 1–4 = volume quartile among the days shown. */
  level: 0 | 1 | 2 | 3 | 4;
  routines: string[];
}

export interface CalendarMonth {
  /** `YYYY-MM`. */
  month: string;
  /** Empty cells before day 1 (Monday-first grid). */
  offset: number;
  days: CalendarDay[];
}

/** Month grids ending at the month of `today`; colour intensity = tonnage quartile. */
export function volumeCalendar(sessions: readonly InsightSession[], today: string, months = 3): CalendarMonth[] {
  const perDay = new Map<string, { tonnage: number; routines: Set<string> }>();
  for (const s of sessions) {
    const day = s.date.slice(0, 10);
    const cur = perDay.get(day) ?? { tonnage: 0, routines: new Set<string>() };
    cur.tonnage += tonnage(s.sets);
    cur.routines.add(s.routine);
    perDay.set(day, cur);
  }
  const [ty, tm] = today.split("-").map(Number);
  const list: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ty, tm - 1 - i, 1));
    list.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const shown = [...perDay].filter(([day]) => list.includes(day.slice(0, 7))).map(([, v]) => v.tonnage).filter((t) => t > 0);
  const q = [0.25, 0.5, 0.75].map((p) => (shown.length ? quantile(shown, p) : 0));
  const levelOf = (t: number): 1 | 2 | 3 | 4 => (t <= q[0] ? 1 : t <= q[1] ? 2 : t <= q[2] ? 3 : 4);

  return list.map((month) => {
    const [y, m] = month.split("-").map(Number);
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    const days: CalendarDay[] = Array.from({ length: count }, (_, i) => {
      const date = `${month}-${String(i + 1).padStart(2, "0")}`;
      const v = perDay.get(date);
      return {
        date,
        day: i + 1,
        tonnage: v ? Math.round(v.tonnage) : null,
        level: v && v.tonnage > 0 ? levelOf(v.tonnage) : v ? 1 : 0,
        routines: v ? [...v.routines] : [],
      };
    });
    return { month, offset, days };
  });
}

// ---------------------------------------------------------------- 4. rep ranges per muscle

export const REP_BUCKETS = ["1–5", "6–10", "11–15", "16+"] as const;

export interface RepDistribution {
  group: string;
  total: number;
  /** Working sets per bucket (same order as REP_BUCKETS). */
  counts: number[];
}

const repBucket = (reps: number) => (reps <= 5 ? 0 : reps <= 10 ? 1 : reps <= 15 ? 2 : 3);

/** Working sets by rep range and muscle group over the last `weeks` weeks (current one included). */
export function repDistribution(sessions: readonly InsightSession[], today: string, weeks = 8): RepDistribution[] {
  const since = addDays(isoWeekStart(today), -7 * (weeks - 1));
  const map = new Map<string, number[]>();
  for (const s of sessions) {
    if (!s.muscle_group || s.date.slice(0, 10) < since) continue;
    const counts = map.get(s.muscle_group) ?? [0, 0, 0, 0];
    for (const set of s.sets) if (!set.is_warmup) counts[repBucket(set.reps)]++;
    map.set(s.muscle_group, counts);
  }
  return [...map]
    .map(([group, counts]) => ({ group, counts, total: counts.reduce((a, b) => a + b, 0) }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total || a.group.localeCompare(b.group));
}

// ---------------------------------------------------------------- 5. weekly pace

export interface WeeklyPacePoint {
  week_start: string;
  surface: Surface;
  km: number;
  /** Σtime / Σdistance of the week, seconds per km. */
  pace: number;
  elevation_m: number;
}

/** Weighted pace per week and surface (never the mean of paces). */
export function weeklyPace(runs: readonly RunLike[]): WeeklyPacePoint[] {
  const groups = new Map<string, RunLike[]>();
  for (const r of runs) {
    const key = `${isoWeekStart(r.date)}|${r.surface}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups]
    .flatMap(([key, list]) => {
      const sum = summarizeRuns(list);
      if (sum.pace_s_per_km === null) return [];
      const [week_start, surface] = key.split("|");
      return [{ week_start, surface: surface as Surface, km: round(sum.distance_km, 2), pace: Math.round(sum.pace_s_per_km), elevation_m: sum.elevation_gain_m }];
    })
    .sort((a, b) => a.week_start.localeCompare(b.week_start));
}

// ---------------------------------------------------------------- 6. steps by weekday

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

export interface WeekdayStep {
  weekday: (typeof WEEKDAYS)[number];
  n: number;
  mean: number | null;
  median: number | null;
  /** Share of the days with data at or above the goal (null without data). */
  above_goal: number | null;
}

/** Steps by weekday; days without data are not zero. */
export function weekdayProfile(steps: readonly DatedValue[], goal: number): WeekdayStep[] {
  const buckets: number[][] = WEEKDAYS.map(() => []);
  for (const s of steps) buckets[(new Date(`${s.date.slice(0, 10)}T00:00:00Z`).getUTCDay() + 6) % 7].push(s.value);
  return WEEKDAYS.map((weekday, i) => {
    const v = buckets[i];
    return {
      weekday,
      n: v.length,
      mean: v.length ? Math.round(mean(v)) : null,
      median: v.length ? Math.round(median(v)) : null,
      above_goal: v.length ? v.filter((x) => x >= goal).length / v.length : null,
    };
  });
}

// ---------------------------------------------------------------- 8. time of day

export interface HourBucket {
  label: string;
  n: number;
  mean_tonnage: number | null;
}

const HOURS: { label: string; test: (h: number) => boolean }[] = [
  { label: "Antes de las 9", test: (h) => h < 9 },
  { label: "9–12", test: (h) => h >= 9 && h < 12 },
  { label: "12–16", test: (h) => h >= 12 && h < 16 },
  { label: "16–20", test: (h) => h >= 16 && h < 20 },
  { label: "20 o más tarde", test: (h) => h >= 20 },
];

/** Tonnage of each workout by the local hour it started (the stored time is local). */
export function hourOfDay(sessions: readonly InsightSession[]): HourBucket[] {
  const perWorkout = new Map<string, number>();
  for (const s of sessions) perWorkout.set(s.date, (perWorkout.get(s.date) ?? 0) + tonnage(s.sets));
  const buckets = HOURS.map((b) => ({ ...b, values: [] as number[] }));
  for (const [date, t] of perWorkout) {
    const hour = Number(date.slice(11, 13));
    if (Number.isNaN(hour)) continue;
    buckets.find((b) => b.test(hour))?.values.push(t);
  }
  return buckets.map((b) => ({ label: b.label, n: b.values.length, mean_tonnage: b.values.length ? Math.round(mean(b.values)) : null }));
}
