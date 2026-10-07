import { median, mulberry32, quantile } from "./util";

export interface TheilSenFit {
  slope: number;
  intercept: number;
  /** Percentile bootstrap 95 % CI of the slope. */
  ci95: [number, number];
  n: number;
}

/** Median of all pairwise slopes (pairs with equal x are skipped). */
export function theilSenSlope(xs: readonly number[], ys: readonly number[]): number {
  const slopes: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      if (xs[j] !== xs[i]) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
    }
  }
  return slopes.length ? median(slopes) : NaN;
}

export function theilSen(
  xs: readonly number[],
  ys: readonly number[],
  { resamples = 2000, seed = 42 }: { resamples?: number; seed?: number } = {},
): TheilSenFit | null {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return null;
  const slope = theilSenSlope(xs, ys);
  if (!Number.isFinite(slope)) return null;
  const intercept = median(ys.map((y, i) => y - slope * xs[i]));

  const rand = mulberry32(seed);
  const boot: number[] = [];
  const bx = new Array<number>(n);
  const by = new Array<number>(n);
  for (let r = 0; r < resamples; r++) {
    for (let k = 0; k < n; k++) {
      const idx = Math.floor(rand() * n);
      bx[k] = xs[idx];
      by[k] = ys[idx];
    }
    const s = theilSenSlope(bx, by);
    if (Number.isFinite(s)) boot.push(s);
  }
  const ci95: [number, number] = [quantile(boot, 0.025), quantile(boot, 0.975)];
  return { slope, intercept, ci95, n };
}
