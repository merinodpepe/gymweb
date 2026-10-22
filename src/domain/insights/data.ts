import type { WorkoutSet } from "../schemas/workout";
import { sessionE1rm } from "../stats/e1rm";
import { ewmaIrregular, type DatedValue } from "../stats/ewma";
import type { RunLike } from "../stats/pace";
import { STRENGTH_ALPHA } from "../stats/strengthTrend";
import { WEIGHT_ALPHA } from "../stats/bodyTrend";
import { addDays, daysBetween, isoWeekStart } from "../stats/weeks";

/** One exercise entry of one workout (the unit the history comes in). */
export interface InsightSession {
  /** `YYYY-MM-DDTHH:mm`. */
  date: string;
  routine: string;
  /** 0-based position of the exercise inside the workout. */
  position: number;
  /** Canonical exercise name. */
  exercise: string;
  muscle_group: string | null;
  sets: readonly WorkoutSet[];
}

/** Everything the cross-views read. Body weight is already corrected for scale bias. */
export interface InsightData {
  today: string;
  weights: DatedValue[];
  steps: DatedValue[];
  runs: RunLike[];
  sessions: InsightSession[];
}

export const LEG_GROUPS: readonly string[] = ["Cuádriceps", "Isquios", "Glúteo", "Gemelo"];

/** Last value on or before `date` (YYYY-MM-DD); null if none or older than `maxStaleDays`. */
export function valueAt(series: readonly DatedValue[], date: string, maxStaleDays: number): number | null {
  let found: DatedValue | null = null;
  for (const p of series) {
    if (p.date.slice(0, 10) <= date) found = p;
    else break;
  }
  return found && daysBetween(found.date.slice(0, 10), date) <= maxStaleDays ? found.value : null;
}

/** Sunday of the week starting `monday`. */
export const weekEnd = (monday: string) => addDays(monday, 6);

/** Mondays from `from` to `to` inclusive. */
export function weekRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let w = isoWeekStart(from); w <= to; w = addDays(w, 7)) out.push(w);
  return out;
}

/** The last complete week's Monday before `today`. */
export const lastCompleteWeek = (today: string) => addDays(isoWeekStart(today), -7);

/** Km per complete week; weeks without runs between the first run and the last complete week count 0. */
export function weeklyKm(runs: readonly RunLike[], today: string): Map<string, number> {
  const last = lastCompleteWeek(today);
  const out = new Map<string, number>();
  const first = runs.map((r) => r.date).sort()[0];
  if (!first) return out;
  for (const w of weekRange(first, last)) out.set(w, 0);
  for (const r of runs) {
    const w = isoWeekStart(r.date);
    if (out.has(w)) out.set(w, out.get(w)! + r.distance_km);
  }
  return out;
}

/** Mean steps per complete week with at least `minDays` days of data (days without data are not 0). */
export function weeklyStepsMean(steps: readonly DatedValue[], today: string, minDays = 4): Map<string, number> {
  const last = lastCompleteWeek(today);
  const byWeek = new Map<string, number[]>();
  for (const s of steps) {
    const w = isoWeekStart(s.date);
    if (w <= last) byWeek.set(w, [...(byWeek.get(w) ?? []), s.value]);
  }
  const out = new Map<string, number>();
  for (const [w, v] of byWeek) if (v.length >= minDays) out.set(w, v.reduce((a, b) => a + b, 0) / v.length);
  return out;
}

export interface WeightWeek {
  week_start: string;
  /** EWMA at the end of the week minus the EWMA at the end of the previous one (kg). */
  change_kg: number;
}

/** Weekly change of the EWMA weight over complete weeks with ≥ `minObs` weigh-ins. */
export function weeklyWeightChange(weights: readonly DatedValue[], today: string, minObs = 2): WeightWeek[] {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const ewma = ewmaIrregular(sorted, WEIGHT_ALPHA, 1);
  const first = sorted[0]?.date;
  if (!first) return [];
  const out: WeightWeek[] = [];
  for (const w of weekRange(first, lastCompleteWeek(today))) {
    const obs = sorted.filter((p) => p.date >= w && p.date <= weekEnd(w)).length;
    const now = valueAt(ewma, weekEnd(w), 7);
    const before = valueAt(ewma, addDays(w, -1), 7);
    if (obs >= minObs && now !== null && before !== null) out.push({ week_start: w, change_kg: now - before });
  }
  return out;
}

export interface ExerciseSeries {
  exercise: string;
  muscle_group: string | null;
  /** One e1RM per training day (best eligible set of that day). */
  points: DatedValue[];
  ewma: DatedValue[];
}

/** e1RM per day and exercise (several entries on the same day are merged), with its EWMA. */
export function exerciseSeries(sessions: readonly InsightSession[]): ExerciseSeries[] {
  const byExercise = new Map<string, { group: string | null; days: Map<string, WorkoutSet[]> }>();
  for (const s of sessions) {
    let e = byExercise.get(s.exercise);
    if (!e) byExercise.set(s.exercise, (e = { group: s.muscle_group, days: new Map() }));
    e.group = e.group ?? s.muscle_group;
    const day = s.date.slice(0, 10);
    e.days.set(day, [...(e.days.get(day) ?? []), ...s.sets]);
  }
  const out: ExerciseSeries[] = [];
  for (const [exercise, e] of byExercise) {
    const points = [...e.days]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .flatMap(([date, sets]) => {
        const value = sessionE1rm(sets);
        return value === null ? [] : [{ date, value }];
      });
    out.push({ exercise, muscle_group: e.group, points, ewma: ewmaIrregular(points, STRENGTH_ALPHA, 7) });
  }
  return out;
}

/** Direct working sets per group on each training day. */
export function groupDays(sessions: readonly InsightSession[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const s of sessions) {
    if (!s.muscle_group) continue;
    const n = s.sets.filter((x) => !x.is_warmup).length;
    if (!n) continue;
    const g = out.get(s.muscle_group) ?? new Map<string, number>();
    const day = s.date.slice(0, 10);
    g.set(day, (g.get(day) ?? 0) + n);
    out.set(s.muscle_group, g);
  }
  return out;
}
