import { mean, mulberry32, quantile } from "./util";
import { addDays } from "./weeks";

/** Below this many pairs no coefficient is shown, only the scatter plot (plan, 15.1). */
export const MIN_PAIRS = 30;
/** False-discovery rate used when several relations are tested at once. */
export const FDR = 0.05;

/** Average ranks (1-based); ties share the mean of their positions. */
export function ranks(xs: readonly number[]): number[] {
  const idx = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const out = new Array<number>(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && xs[idx[j + 1]] === xs[idx[i]]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[idx[k]] = r;
    i = j + 1;
  }
  return out;
}

/** Pearson correlation; NaN if either side is constant or n < 3. */
function pearson(xs: readonly number[], ys: readonly number[]): number {
  const n = xs.length;
  if (n < 3) return NaN;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/** Spearman rank correlation (Pearson on average ranks). */
export const spearman = (xs: readonly number[], ys: readonly number[]) => pearson(ranks(xs), ranks(ys));

export interface Relation {
  n: number;
  /** Null while n < MIN_PAIRS (or a side is constant): only the scatter plot is shown. */
  rho: number | null;
  /** Percentile bootstrap 95 % CI of rho. */
  ci95: [number, number] | null;
  /** Two-sided permutation p-value. */
  p: number | null;
  enough: boolean;
}

export interface RelateOptions {
  resamples?: number;
  permutations?: number;
  seed?: number;
  minPairs?: number;
}

/** Spearman rho with bootstrap CI and permutation p-value. No coefficient with fewer than `minPairs` pairs. */
export function relate(
  xs: readonly number[],
  ys: readonly number[],
  { resamples = 1000, permutations = 2000, seed = 7, minPairs = MIN_PAIRS }: RelateOptions = {},
): Relation {
  const n = Math.min(xs.length, ys.length);
  const none: Relation = { n, rho: null, ci95: null, p: null, enough: false };
  if (n < minPairs) return none;
  const rho = spearman(xs, ys);
  if (!Number.isFinite(rho)) return none;

  const rand = mulberry32(seed);
  const boot: number[] = [];
  const bx = new Array<number>(n);
  const by = new Array<number>(n);
  for (let r = 0; r < resamples; r++) {
    for (let k = 0; k < n; k++) {
      const i = Math.floor(rand() * n);
      bx[k] = xs[i];
      by[k] = ys[i];
    }
    const s = spearman(bx, by);
    if (Number.isFinite(s)) boot.push(s);
  }

  // Permuting the ranks of y is enough: Spearman is Pearson on ranks.
  const rx = ranks(xs);
  const ry = ranks(ys);
  let extreme = 0;
  for (let r = 0; r < permutations; r++) {
    for (let k = n - 1; k > 0; k--) {
      const j = Math.floor(rand() * (k + 1));
      [ry[k], ry[j]] = [ry[j], ry[k]];
    }
    if (Math.abs(pearson(rx, ry)) >= Math.abs(rho) - 1e-12) extreme++;
  }
  return {
    n,
    rho,
    ci95: boot.length ? [quantile(boot, 0.025), quantile(boot, 0.975)] : null,
    p: (extreme + 1) / (permutations + 1),
    enough: true,
  };
}

/**
 * Benjamini–Hochberg: which hypotheses survive at false-discovery rate `q`.
 * `null` p-values (not enough data) never survive and do not count as tests.
 */
export function benjaminiHochberg(ps: readonly (number | null)[], q = FDR): boolean[] {
  const tested = ps.flatMap((p, i) => (p === null ? [] : [{ p, i }])).sort((a, b) => a.p - b.p);
  const m = tested.length;
  let cut = -1;
  tested.forEach(({ p }, k) => {
    if (p <= ((k + 1) / m) * q) cut = k;
  });
  const out = ps.map(() => false);
  for (let k = 0; k <= cut; k++) out[tested[k].i] = true;
  return out;
}

export interface LagScan {
  /** Lag (in weeks) with the strongest |rho|; `y` is read `lag` weeks after `x`. */
  lag: number;
  /** How many lags were tried: trying many inflates chance findings. */
  tried: number;
  pairs: { x: number; y: number; week: string }[];
  relation: Relation;
}

/**
 * Pairs `x[week]` with `y[week + lag]` for each lag and keeps the lag with the strongest rank correlation.
 * With too few pairs it returns lag 0 and only the scatter plot. Weeks are `YYYY-MM-DD` Mondays.
 */
export function bestLag(
  x: ReadonlyMap<string, number>,
  y: ReadonlyMap<string, number>,
  lags: readonly number[],
  options?: RelateOptions,
): LagScan {
  const build = (lag: number) => {
    const pairs: LagScan["pairs"] = [];
    for (const [week, xv] of x) {
      const yv = y.get(addDays(week, 7 * lag));
      if (yv !== undefined) pairs.push({ x: xv, y: yv, week });
    }
    return pairs.sort((a, b) => a.week.localeCompare(b.week));
  };
  let best: LagScan | null = null;
  for (const lag of lags) {
    const pairs = build(lag);
    const relation = relate(pairs.map((p) => p.x), pairs.map((p) => p.y), options);
    const better =
      best === null ||
      (relation.enough && (!best.relation.enough || Math.abs(relation.rho!) > Math.abs(best.relation.rho!))) ||
      (!relation.enough && !best.relation.enough && pairs.length > best.pairs.length);
    if (better) best = { lag, tried: lags.length, pairs, relation };
  }
  return best ?? { lag: 0, tried: 0, pairs: [], relation: relate([], []) };
}

/** Plain-language strength of |rho| (Spearman). */
export function strengthWord(rho: number): string {
  const a = Math.abs(rho);
  return a >= 0.6 ? "fuerte" : a >= 0.4 ? "moderada" : a >= 0.2 ? "débil" : "muy débil";
}
