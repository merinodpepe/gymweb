import type { DatedValue } from "./ewma";
import type { TrendLabel } from "./regression";
import { daysBetween } from "./weeks";

export const PLATEAU_MIN_SESSIONS = 4;
export const PLATEAU_MIN_DAYS = 21;
/** A session only counts as progress if it beats the previous best by more than this. */
export const PLATEAU_GAIN_PCT = 0.01;

export type ExerciseStatus = "mejorando" | "estancado" | "bajando" | "pocos_datos";

export interface PlateauInfo {
  status: ExerciseStatus;
  /** Sessions since the last one that beat the previous best e1RM. */
  sessions_since_gain: number;
  days_since_gain: number;
  best_e1rm: number | null;
}

/**
 * Plateau = no new e1RM best (+1 %) for ≥ 4 sessions and ≥ 21 days, and the
 * 12-week trend is not clearly up. "Bajando" = a clear downward trend.
 */
export function detectPlateau(points: readonly DatedValue[], trend: TrendLabel | null): PlateauInfo {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < PLATEAU_MIN_SESSIONS) {
    return { status: "pocos_datos", sessions_since_gain: 0, days_since_gain: 0, best_e1rm: sorted.length ? Math.max(...sorted.map((p) => p.value)) : null };
  }
  let best = sorted[0].value;
  let gainIdx = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].value > best * (1 + PLATEAU_GAIN_PCT)) gainIdx = i;
    best = Math.max(best, sorted[i].value);
  }
  const sessions = sorted.length - 1 - gainIdx;
  const days = Math.floor(daysBetween(sorted[gainIdx].date, sorted[sorted.length - 1].date));
  const status: ExerciseStatus =
    trend === "down" ? "bajando" : sessions >= PLATEAU_MIN_SESSIONS && days >= PLATEAU_MIN_DAYS && trend !== "up" ? "estancado" : "mejorando";
  return { status, sessions_since_gain: sessions, days_since_gain: days, best_e1rm: best };
}
