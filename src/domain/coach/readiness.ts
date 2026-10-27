import type { WorkoutSet } from "../schemas/workout";
import { MUSCLE_GROUPS } from "../muscles/matchMuscle";
import { daysBetween } from "../stats/weeks";
import { type CoachSession, INDIRECT_WEIGHT } from "./weeklyCoach";

/**
 * Recovery model (orientative): every working set adds fatigue to its muscle, which decays exponentially
 * with a time constant τ per muscle. Large muscles recover more slowly (~48–72 h after a hard session).
 * Edit these constants to tune the map.
 */
export const RECOVERY_TAU_H: Record<string, number> = {
  Pecho: 30,
  Espalda: 30,
  Cuádriceps: 30,
  Isquios: 30,
  Glúteo: 30,
  Hombro: 20,
  Bíceps: 20,
  Tríceps: 20,
  Gemelo: 20,
  Core: 20,
  Antebrazo: 20,
};
const DEFAULT_TAU_H = 24;
export const tauFor = (group: string) => RECOVERY_TAU_H[group] ?? DEFAULT_TAU_H;

/** A set to failure costs this much more recovery than a normal working set. */
export const FAILURE_FACTOR = 1.3;
/** Fatigue (in sets) that leaves a muscle at 0 % readiness: roughly one hard session for it. */
export const FULL_FATIGUE_SETS = 10;
/** Readiness from which a muscle counts as ready to train again. */
export const READY_AT = 0.85;
/** Only sessions this recent are considered. */
export const LOOKBACK_DAYS = 7;
/** Sessions stored without a time are assumed to have been trained at this hour. */
const DEFAULT_TIME = "18:00";

export type ReadinessLevel = "listo" | "casi" | "recuperando" | "fatigado";

export interface GroupReadiness {
  group: string;
  /** 0 (exhausted) → 1 (fully recovered). */
  readiness: number;
  level: ReadinessLevel;
  /** Hours until readiness reaches READY_AT (0 if already there). */
  hours_to_ready: number;
  /** `YYYY-MM-DD` of the last session in the window that worked it (directly or not), or null. */
  last_session: string | null;
  /** Working sets in the window (indirect ones at INDIRECT_WEIGHT). */
  recent_sets: number;
}

export function levelOf(readiness: number): ReadinessLevel {
  if (readiness >= READY_AT) return "listo";
  if (readiness >= 0.6) return "casi";
  if (readiness >= 0.3) return "recuperando";
  return "fatigado";
}

const load = (sets: readonly WorkoutSet[]) =>
  sets.filter((s) => !s.is_warmup).reduce((t, s) => t + (s.is_failure ? FAILURE_FACTOR : 1), 0);
const plainSets = (sets: readonly WorkoutSet[]) => sets.filter((s) => !s.is_warmup).length;
const withTime = (date: string) => (date.includes("T") ? date : `${date}T${DEFAULT_TIME}`);
const round1 = (x: number) => Math.round(x * 10) / 10;

/** How recovered each muscle group is at `now` (`YYYY-MM-DDTHH:mm`, local time). Most fatigued first. */
export function muscleReadiness(items: readonly CoachSession[], now: string): GroupReadiness[] {
  const fatigue = new Map<string, number>();
  const sets = new Map<string, number>();
  const last = new Map<string, string>();

  for (const it of items) {
    const hours = daysBetween(withTime(it.date), now) * 24;
    if (hours < 0 || hours > LOOKBACK_DAYS * 24) continue;
    const l = load(it.sets);
    const n = plainSets(it.sets);
    if (!n) continue;
    const credit = (g: string, w: number) => {
      fatigue.set(g, (fatigue.get(g) ?? 0) + l * w * Math.exp(-hours / tauFor(g)));
      sets.set(g, (sets.get(g) ?? 0) + n * w);
      const d = it.date.slice(0, 10);
      if (d > (last.get(g) ?? "")) last.set(g, d);
    };
    if (it.muscle_group) credit(it.muscle_group, 1);
    for (const g of it.secondary) if (g !== it.muscle_group) credit(g, INDIRECT_WEIGHT);
  }

  const names = [...new Set([...MUSCLE_GROUPS, ...fatigue.keys()])];
  return names
    .map((group) => {
      const f = fatigue.get(group) ?? 0;
      const readiness = Math.min(1, Math.max(0, 1 - f / FULL_FATIGUE_SETS));
      // One τ per muscle, so total fatigue decays as a single exponential: solve f·e^(−h/τ) = (1 − READY_AT)·FULL.
      const threshold = (1 - READY_AT) * FULL_FATIGUE_SETS;
      const hours_to_ready = f > threshold ? Math.ceil(tauFor(group) * Math.log(f / threshold)) : 0;
      return {
        group,
        readiness,
        level: levelOf(readiness),
        hours_to_ready,
        last_session: last.get(group) ?? null,
        recent_sets: round1(sets.get(group) ?? 0),
      };
    })
    .sort((a, b) => a.readiness - b.readiness || a.group.localeCompare(b.group));
}
