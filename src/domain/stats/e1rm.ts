import type { WorkoutSet } from "../schemas/workout";

export const MAX_E1RM_REPS = 10;

export const epley = (w: number, r: number) => w * (1 + r / 30);
export const brzycki = (w: number, r: number) => (w * 36) / (37 - r);

export function isE1rmEligible(s: WorkoutSet): boolean {
  return !s.is_warmup && s.reps >= 1 && s.reps <= MAX_E1RM_REPS && s.weight_kg > 0;
}

/** Mean of Epley and Brzycki; a single rep is the real 1RM. */
export function setE1rm(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return (epley(weight, reps) + brzycki(weight, reps)) / 2;
}

/** One observation per session: the best e1RM among eligible sets (null if none). */
export function sessionE1rm(sets: readonly WorkoutSet[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (!isE1rmEligible(s)) continue;
    const e = setE1rm(s.weight_kg, s.reps);
    if (best === null || e > best) best = e;
  }
  return best;
}
