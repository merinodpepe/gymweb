import { theilSenSlope } from "./theilSen";
import { median } from "./util";
import { addDays, dayNumber } from "./weeks";

/**
 * Scale calibration. Model: measured = true weight(day) + bias(scale) + noise, with the
 * biases summing to 0, so the "real" weight is the mean of all scales.
 *
 * Weigh-ins on different scales a few days apart are paired; the weight change between
 * those days (local Theil-Sen slope) is subtracted, and the robust per-pair-of-scales
 * difference feeds a weighted least-squares solve for the biases.
 */
export const SCALE_WINDOW_DAYS = 180;
export const SCALE_MAX_GAP_DAYS = 3;
export const SCALE_SLOPE_HALF_WINDOW = 14;
const SLOPE_MIN_OBS = 3;
const PASSES = 2;

export interface WeighIn {
  date: string;
  value: number;
  scale: string | null;
}

export type ScaleConfidence = "baja" | "media" | "alta";

export interface ScaleOffset {
  scale: string;
  /** kg this scale reads above (+) or below (−) the mean of scales; null = not calibrated. */
  offset: number | null;
  /** Half-width of the approximate 95 % CI of `offset`. */
  ci95: number | null;
  /** Pairs with other scales used for the estimate. */
  pairs: number;
  weighIns: number;
  confidence: ScaleConfidence | null;
}

export interface ScaleCalibration {
  scales: ScaleOffset[];
  /** Measured value minus the scale's bias (unchanged for unknown or uncalibrated scales). */
  correct: (w: WeighIn) => number;
}

interface Pair {
  a: number;
  b: number;
  /** (y_a − y_b) corrected for the weight change between both days. */
  diff: number;
  weight: number;
}

const confidenceFor = (pairs: number): ScaleConfidence => (pairs < 5 ? "baja" : pairs < 15 ? "media" : "alta");

function weightedMedian(values: readonly number[], weights: readonly number[]): number {
  const idx = values.map((_, i) => i).sort((i, j) => values[i] - values[j]);
  const half = weights.reduce((s, w) => s + w, 0) / 2;
  let acc = 0;
  for (const i of idx) {
    acc += weights[i];
    if (acc >= half) return values[i];
  }
  return values[idx[idx.length - 1]];
}

/** Solves A x = b by Gaussian elimination with partial pivoting (A is small and dense). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Inverse of (L + J/k); for a connected graph Laplacian L this is L⁺ + J/k. */
function shiftedInverse(L: number[][]): number[][] {
  const k = L.length;
  const S = L.map((row) => row.map((v) => v + 1 / k));
  return S.map((_, j) => solve(S, S.map((__, i) => (i === j ? 1 : 0))));
}

/** Connected components of the scales graph (edge = at least one pair). */
function components(k: number, edges: ReadonlySet<string>): number[][] {
  const seen = new Array<boolean>(k).fill(false);
  const out: number[][] = [];
  for (let s = 0; s < k; s++) {
    if (seen[s]) continue;
    const comp: number[] = [];
    const stack = [s];
    seen[s] = true;
    while (stack.length) {
      const u = stack.pop()!;
      comp.push(u);
      for (let v = 0; v < k; v++) {
        if (!seen[v] && edges.has(u < v ? `${u}:${v}` : `${v}:${u}`)) {
          seen[v] = true;
          stack.push(v);
        }
      }
    }
    out.push(comp);
  }
  return out;
}

export function calibrateScales(all: readonly WeighIn[], today: string): ScaleCalibration {
  const from = addDays(today, -SCALE_WINDOW_DAYS);
  const points = all
    .filter((p) => p.scale !== null && p.date >= from && p.date <= today)
    .sort((x, y) => x.date.localeCompare(y.date));
  const names = [...new Set(points.map((p) => p.scale!))].sort((x, y) => x.localeCompare(y));
  const index = new Map(names.map((n, i) => [n, i]));
  const k = names.length;
  const days = points.map((p) => dayNumber(p.date));
  const scaleOf = points.map((p) => index.get(p.scale!)!);

  let bias = new Array<number>(k).fill(0);
  let calibrated = new Array<boolean>(k).fill(false);
  let ci = new Array<number | null>(k).fill(null);
  const pairCount = new Array<number>(k).fill(0);

  for (let pass = 0; pass < PASSES; pass++) {
    const corrected = points.map((p, i) => p.value - bias[scaleOf[i]]);
    const slopeAt = (day: number) => {
      const idx = days.flatMap((d, i) => (Math.abs(d - day) <= SCALE_SLOPE_HALF_WINDOW ? [i] : []));
      if (idx.length < SLOPE_MIN_OBS) return 0;
      const s = theilSenSlope(idx.map((i) => days[i]), idx.map((i) => corrected[i]));
      return Number.isFinite(s) ? s : 0;
    };

    const pairs: Pair[] = [];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length && days[j] - days[i] <= SCALE_MAX_GAP_DAYS; j++) {
        if (scaleOf[i] === scaleOf[j]) continue;
        const gap = days[j] - days[i];
        const drift = slopeAt((days[i] + days[j]) / 2) * gap;
        // Orient every pair as lower index − higher index.
        const [a, b, diff] =
          scaleOf[i] < scaleOf[j]
            ? [scaleOf[i], scaleOf[j], points[i].value - (points[j].value - drift)]
            : [scaleOf[j], scaleOf[i], points[j].value - drift - points[i].value];
        pairs.push({ a, b, diff, weight: 1 / (1 + gap) });
      }
    }

    // Robust difference per pair of scales.
    const groups = new Map<string, Pair[]>();
    for (const p of pairs) {
      const key = `${p.a}:${p.b}`;
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    const delta = new Map<string, number>();
    for (const [key, g] of groups) delta.set(key, weightedMedian(g.map((p) => p.diff), g.map((p) => p.weight)));

    // Only the largest connected group of scales shares a common reference.
    const comp = components(k, new Set(groups.keys())).sort(
      (x, y) => pairs.filter((p) => y.includes(p.a)).length - pairs.filter((p) => x.includes(p.a)).length,
    )[0] ?? [];
    bias = new Array<number>(k).fill(0);
    calibrated = new Array<boolean>(k).fill(false);
    ci = new Array<number | null>(k).fill(null);
    pairCount.fill(0);
    for (const p of pairs) {
      pairCount[p.a]++;
      pairCount[p.b]++;
    }
    if (comp.length < 2) continue;

    // Weighted least squares: min Σ W_ab (b_a − b_b − Δ_ab)² subject to Σ b = 0.
    const pos = new Map(comp.map((s, i) => [s, i]));
    const m = comp.length;
    const Lw = Array.from({ length: m }, () => new Array<number>(m).fill(0));
    const Ln = Array.from({ length: m }, () => new Array<number>(m).fill(0));
    const r = new Array<number>(m).fill(0);
    for (const [key, g] of groups) {
      const [a, b] = key.split(":").map(Number);
      const ia = pos.get(a);
      const ib = pos.get(b);
      if (ia === undefined || ib === undefined) continue;
      const W = g.reduce((s, p) => s + p.weight, 0);
      const d = delta.get(key)!;
      Lw[ia][ia] += W;
      Lw[ib][ib] += W;
      Lw[ia][ib] -= W;
      Lw[ib][ia] -= W;
      Ln[ia][ia] += g.length;
      Ln[ib][ib] += g.length;
      Ln[ia][ib] -= g.length;
      Ln[ib][ia] -= g.length;
      r[ia] += W * d;
      r[ib] -= W * d;
    }
    const sol = solve(Lw.map((row) => row.map((v) => v + 1 / m)), r);
    comp.forEach((s, i) => {
      bias[s] = sol[i];
      calibrated[s] = true;
    });

    // Approximate CI: robust spread of pair residuals, propagated through L⁺ (pair counts).
    const residuals = pairs
      .filter((p) => calibrated[p.a] && calibrated[p.b])
      .map((p) => p.diff - (bias[p.a] - bias[p.b]));
    if (residuals.length >= 2) {
      const mad = median(residuals.map((x) => Math.abs(x - median(residuals))));
      const sigma = 1.2533 * 1.4826 * mad; // SE factor of a median × robust SD
      const inv = shiftedInverse(Ln);
      comp.forEach((s, i) => {
        const variance = inv[i][i] - 1 / m;
        ci[s] = variance > 0 ? 1.96 * sigma * Math.sqrt(variance) : null;
      });
    }
  }

  const scales: ScaleOffset[] = names.map((scale, s) => ({
    scale,
    offset: calibrated[s] ? bias[s] : null,
    ci95: ci[s],
    pairs: pairCount[s],
    weighIns: scaleOf.filter((x) => x === s).length,
    confidence: calibrated[s] ? confidenceFor(pairCount[s]) : null,
  }));
  const byName = new Map(scales.map((s) => [s.scale, s.offset]));
  return {
    scales,
    correct: (w) => w.value - ((w.scale !== null ? byName.get(w.scale) : null) ?? 0),
  };
}
