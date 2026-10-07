export const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

export const mean = (xs: readonly number[]) => (xs.length ? sum(xs) / xs.length : NaN);

/** Sample standard deviation (n − 1). */
export function sd(xs: readonly number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}

/** Quantile with linear interpolation (type 7, same as numpy/scipy default). */
export function quantile(xs: readonly number[], p: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const h = (s.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return s[lo] + (h - lo) * (s[hi] - s[lo]);
}

export const median = (xs: readonly number[]) => quantile(xs, 0.5);

/** Deterministic PRNG so bootstrap intervals are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Two-sided 95 % Student-t critical values (scipy.stats.t.ppf(0.975, df)).
const T975: Array<[number, number]> = [
  [1, 12.7062], [2, 4.3027], [3, 3.1824], [4, 2.7764], [5, 2.5706], [6, 2.4469],
  [7, 2.3646], [8, 2.306], [9, 2.2622], [10, 2.2281], [11, 2.201], [12, 2.1788],
  [13, 2.1604], [14, 2.1448], [15, 2.1314], [16, 2.1199], [17, 2.1098], [18, 2.1009],
  [19, 2.093], [20, 2.086], [21, 2.0796], [22, 2.0739], [23, 2.0687], [24, 2.0639],
  [25, 2.0595], [26, 2.0555], [27, 2.0518], [28, 2.0484], [29, 2.0452], [30, 2.0423],
  [40, 2.0211], [60, 2.0003], [120, 1.9799],
];

/** t.ppf(0.975, df); interpolated in 1/df beyond the table, → 1.96 as df → ∞. */
export function tCrit95(df: number): number {
  if (df < 1) return NaN;
  const exact = T975.find(([d]) => d === df);
  if (exact) return exact[1];
  const pts: Array<[number, number]> = [...T975, [Infinity, 1.959964]];
  for (let k = 0; k < pts.length - 1; k++) {
    const [d0, t0] = pts[k];
    const [d1, t1] = pts[k + 1];
    if (df > d0 && df < d1) {
      const u0 = 1 / d0;
      const u1 = d1 === Infinity ? 0 : 1 / d1;
      return t0 + ((1 / df - u0) / (u1 - u0)) * (t1 - t0);
    }
  }
  return 1.959964;
}
