import { mean, sum, tCrit95 } from "./util";

export interface LinearFit {
  slope: number;
  intercept: number;
  ci95: [number, number];
  n: number;
}

/** Ordinary least squares with a Student-t 95 % CI on the slope. */
export function olsFit(xs: readonly number[], ys: readonly number[]): LinearFit | null {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return null;
  const mx = mean(xs);
  const my = mean(ys);
  const sxx = sum(xs.map((x) => (x - mx) ** 2));
  if (sxx === 0) return null;
  const sxy = sum(xs.map((x, i) => (x - mx) * (ys[i] - my)));
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const sse = sum(ys.map((y, i) => (y - (intercept + slope * xs[i])) ** 2));
  const se = Math.sqrt(sse / (n - 2) / sxx);
  const t = tCrit95(n - 2);
  return { slope, intercept, ci95: [slope - t * se, slope + t * se], n };
}

export type TrendLabel = "up" | "down" | "flat";

/** ↑/↓ only when the CI excludes 0 and the effect is larger than `minAbs`. */
export function trendLabel(ci: [number, number], slope: number, minAbs = 0): TrendLabel {
  if (ci[0] > 0 && Math.abs(slope) > minAbs) return "up";
  if (ci[1] < 0 && Math.abs(slope) > minAbs) return "down";
  return "flat";
}
