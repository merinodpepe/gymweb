import type { Surface } from "../schemas/run";

export interface RunLike {
  date: string;
  distance_km: number;
  duration_s: number;
  elevation_gain_m?: number;
  surface: Surface;
}

/** Pace in seconds per km of a single run (derived, never stored). */
export const paceSecPerKm = (r: Pick<RunLike, "distance_km" | "duration_s">) => r.duration_s / r.distance_km;

/** Aggregate pace = Σtime / Σdistance (never the mean of paces). */
export function weightedPace(runs: readonly RunLike[]): number | null {
  const d = runs.reduce((s, r) => s + r.distance_km, 0);
  const t = runs.reduce((s, r) => s + r.duration_s, 0);
  return d > 0 ? t / d : null;
}

export interface RunSummary {
  count: number;
  distance_km: number;
  duration_s: number;
  elevation_gain_m: number;
  pace_s_per_km: number | null;
}

export function summarizeRuns(runs: readonly RunLike[]): RunSummary {
  return {
    count: runs.length,
    distance_km: runs.reduce((s, r) => s + r.distance_km, 0),
    duration_s: runs.reduce((s, r) => s + r.duration_s, 0),
    elevation_gain_m: runs.reduce((s, r) => s + (r.elevation_gain_m ?? 0), 0),
    pace_s_per_km: weightedPace(runs),
  };
}

/** Same surface and distance within ±20 % of the reference run. */
export function isComparable(ref: RunLike, other: RunLike, tolerance = 0.2): boolean {
  return (
    ref.surface === other.surface &&
    Math.abs(other.distance_km - ref.distance_km) <= tolerance * ref.distance_km
  );
}

/**
 * Pace change of `run` vs the weighted pace of previous comparable runs
 * (negative seconds = faster). Null when there is nothing comparable.
 */
export function paceVsComparable(run: RunLike, history: readonly RunLike[]): number | null {
  const prior = history.filter((h) => h.date < run.date && isComparable(run, h));
  const ref = weightedPace(prior);
  return ref === null ? null : paceSecPerKm(run) - ref;
}

export function formatPace(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm)) return "—";
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")} /km`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}
