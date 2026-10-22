import { classify, rangeFor } from "../coach/volumeTargets";
import { MUSCLE_GROUPS } from "../muscles/matchMuscle";
import { ewmaIrregular } from "../stats/ewma";
import { summarizeRuns } from "../stats/pace";
import { detectPlateau } from "../stats/plateau";
import { computePrs } from "../stats/prs";
import { strengthTrend } from "../stats/strengthTrend";
import { mean } from "../stats/util";
import { tonnage } from "../stats/volume";
import { addDays } from "../stats/weeks";
import { WEIGHT_ALPHA } from "../stats/bodyTrend";
import type { ScatterCross } from "./crosses";
import { exerciseSeries, type InsightData, valueAt } from "./data";

export interface MonthlyReport {
  /** `YYYY-MM`. */
  month: string;
  /** First and last day covered (the last one is today for the current month). */
  from: string;
  to: string;
  days: number;
  weight: { start: number; end: number; change: number } | null;
  steps: { mean: number; days: number } | null;
  runs: { count: number; km: number; pace_s_per_km: number | null };
  workouts: { count: number; tonnage_kg: number };
  prs: { exercise: string; kind: string; value: number; date: string }[];
  stalled: string[];
  /** Muscles below the weekly minimum, with their mean sets per week this month. */
  neglected: { group: string; sets_per_week: number; min: number }[];
  relations: { id: string; title: string; rho: number; n: number; lag_weeks: number | null }[];
  /** True when no relation has enough data yet to be reported. */
  relations_pending: boolean;
}

export const monthKey = (date: string) => date.slice(0, 7);

/** First and last day of `YYYY-MM`, clamped to `today`. */
export function monthBounds(month: string, today: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { from: `${month}-01`, to: last < today ? last : today };
}

const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

/** One-page summary of a month: weight, steps, km, volume, PRs, stalled exercises, neglected muscles, strongest relations. */
export function monthlyReport(d: InsightData, month: string, crosses: readonly ScatterCross[]): MonthlyReport {
  const { from, to } = monthBounds(month, d.today);
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  const inMonth = <T extends { date: string }>(xs: readonly T[]) => xs.filter((x) => x.date.slice(0, 10) >= from && x.date.slice(0, 10) <= to);

  const ewma = ewmaIrregular([...d.weights].sort((a, b) => a.date.localeCompare(b.date)), WEIGHT_ALPHA, 1);
  const wEnd = valueAt(ewma, to, 14);
  const wStart = valueAt(ewma, addDays(from, -1), 14) ?? ewma.find((p) => p.date >= from && p.date <= to)?.value ?? null;
  const weight = wStart !== null && wEnd !== null ? { start: round(wStart), end: round(wEnd), change: round(wEnd - wStart, 2) } : null;

  const steps = inMonth(d.steps);
  const runs = summarizeRuns(inMonth(d.runs));
  const sessions = inMonth(d.sessions);
  const workoutDays = new Set(sessions.map((s) => s.date.slice(0, 10)));

  // PRs of the month: records beaten, not the first value of a kind (that is just a starting point).
  const prs: MonthlyReport["prs"] = [];
  const stalled: string[] = [];
  const byExercise = new Map<string, typeof d.sessions>();
  for (const s of d.sessions) byExercise.set(s.exercise, [...(byExercise.get(s.exercise) ?? []), s]);
  for (const [exercise, list] of byExercise) {
    const events = computePrs(list.map((s) => ({ date: s.date.slice(0, 10), sets: s.sets }))).events;
    const seen = new Set<string>();
    for (const ev of events) {
      if (seen.has(ev.kind)) {
        if (ev.date >= from && ev.date <= to) prs.push({ exercise, kind: ev.kind, value: round(ev.value), date: ev.date });
      } else seen.add(ev.kind);
    }
  }
  for (const s of exerciseSeries(d.sessions)) {
    if (!s.points.some((p) => p.date >= addDays(to, -28))) continue;
    if (detectPlateau(s.points, strengthTrend(s.points).label).status === "estancado") stalled.push(s.exercise);
  }

  const perGroup = new Map<string, number>();
  for (const s of sessions) if (s.muscle_group) perGroup.set(s.muscle_group, (perGroup.get(s.muscle_group) ?? 0) + s.sets.filter((x) => !x.is_warmup).length);
  const weeks = days / 7;
  const neglected = (MUSCLE_GROUPS as readonly string[])
    .map((group) => ({ group, sets_per_week: round((perGroup.get(group) ?? 0) / weeks), min: rangeFor(group).min }))
    .filter((g) => ["muy_bajo", "bajo"].includes(classify(g.sets_per_week, rangeFor(g.group))))
    .sort((a, b) => a.sets_per_week - b.sets_per_week);

  const reported = crosses
    .filter((c) => c.relation.enough && c.survives && c.relation.rho !== null)
    .sort((a, b) => Math.abs(b.relation.rho!) - Math.abs(a.relation.rho!))
    .slice(0, 3)
    .map((c) => ({ id: c.id, title: c.title, rho: round(c.relation.rho!, 2), n: c.relation.n, lag_weeks: c.lag?.weeks ?? null }));

  return {
    month,
    from,
    to,
    days,
    weight,
    steps: steps.length ? { mean: Math.round(mean(steps.map((s) => s.value))), days: steps.length } : null,
    runs: { count: runs.count, km: round(runs.distance_km), pace_s_per_km: runs.pace_s_per_km },
    workouts: { count: workoutDays.size, tonnage_kg: Math.round(sessions.reduce((t, s) => t + tonnage(s.sets), 0)) },
    prs: prs.sort((a, b) => a.date.localeCompare(b.date)),
    stalled: stalled.sort(),
    neglected,
    relations: reported,
    relations_pending: reported.length === 0,
  };
}
