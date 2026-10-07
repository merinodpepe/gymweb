import type { WorkoutSet } from "../schemas/workout";
import { dayNumber, isoWeekStart } from "./weeks";

/** Tonnage of working sets only (Σ weight × reps). */
export const tonnage = (sets: readonly WorkoutSet[]) =>
  sets.filter((s) => !s.is_warmup).reduce((t, s) => t + s.weight_kg * s.reps, 0);

export interface ExerciseSession {
  date: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm
  muscle_group: string | null;
  sets: readonly WorkoutSet[];
}

export interface WeeklyVolume {
  week_start: string;
  partial: boolean;
  /** Working sets per muscle group. */
  sets_by_group: Record<string, number>;
  tonnage_kg: number;
}

/** Effective (working) sets per muscle group and ISO week (Monday–Sunday). */
export function weeklyVolume(items: readonly ExerciseSession[], today: string): WeeklyVolume[] {
  const currentWeek = isoWeekStart(today);
  const map = new Map<string, WeeklyVolume>();
  for (const it of items) {
    const wk = isoWeekStart(it.date);
    let w = map.get(wk);
    if (!w) {
      w = { week_start: wk, partial: wk === currentWeek, sets_by_group: {}, tonnage_kg: 0 };
      map.set(wk, w);
    }
    const group = it.muscle_group ?? "Sin grupo";
    const working = it.sets.filter((s) => !s.is_warmup).length;
    w.sets_by_group[group] = (w.sets_by_group[group] ?? 0) + working;
    w.tonnage_kg += tonnage(it.sets);
  }
  return [...map.values()].sort((a, b) => a.week_start.localeCompare(b.week_start));
}

/** %e1RM of a set relative to a reference e1RM. */
export const relativeIntensity = (weight: number, e1rm: number) => (e1rm > 0 ? weight / e1rm : NaN);

/**
 * Acute:chronic workload ratio (7 d tonnage vs weekly mean of 28 d).
 * Orientative only — NOT a validated injury predictor.
 */
export function acuteChronicRatio(items: readonly ExerciseSession[], today: string): number | null {
  const t = dayNumber(today) + 1; // include today
  let acute = 0;
  let chronic = 0;
  for (const it of items) {
    const age = t - dayNumber(it.date);
    if (age <= 0) continue;
    const ton = tonnage(it.sets);
    if (age <= 7) acute += ton;
    if (age <= 28) chronic += ton;
  }
  return chronic > 0 ? acute / (chronic / 4) : null;
}
