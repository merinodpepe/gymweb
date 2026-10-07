import type { WorkoutSet } from "../schemas/workout";
import { sessionE1rm } from "./e1rm";

export const REP_TARGETS = [1, 3, 5, 8, 10] as const;

export interface SessionSets {
  date: string;
  sets: readonly WorkoutSet[];
}

export interface PrRecord {
  kind: "e1rm" | `${number}RM`;
  value: number;
  date: string;
}

/** Heaviest working-set weight lifted for at least `reps` reps in a session. */
function bestForReps(sets: readonly WorkoutSet[], reps: number): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (!s.is_warmup && s.reps >= reps && s.weight_kg > 0 && (best === null || s.weight_kg > best)) {
      best = s.weight_kg;
    }
  }
  return best;
}

/**
 * Walks sessions chronologically. A PR is recorded only when the value is
 * strictly greater than the previous historical maximum (the first value
 * counts as the initial record). Returns current records and the PR events.
 */
export function computePrs(sessions: readonly SessionSets[]): { current: PrRecord[]; events: PrRecord[] } {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const best = new Map<string, PrRecord>();
  const events: PrRecord[] = [];
  const consider = (kind: PrRecord["kind"], value: number | null, date: string) => {
    if (value === null) return;
    const prev = best.get(kind);
    if (!prev || value > prev.value) {
      const rec = { kind, value, date };
      best.set(kind, rec);
      events.push(rec);
    }
  };
  for (const s of sorted) {
    consider("e1rm", sessionE1rm(s.sets), s.date);
    for (const r of REP_TARGETS) consider(`${r}RM`, bestForReps(s.sets, r), s.date);
  }
  const order = ["e1rm", ...REP_TARGETS.map((r) => `${r}RM`)];
  const current = [...best.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return { current, events };
}
