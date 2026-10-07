import { dayNumber } from "./weeks";

export interface DatedValue {
  date: string;
  value: number;
}

/**
 * EWMA over irregularly spaced observations. `alpha` is the smoothing factor
 * for one `periodDays` step; longer gaps give the new observation more weight:
 * α_eff = 1 − (1 − α)^(Δdays / periodDays).
 * Input must be sorted by date. Missing days are never filled.
 */
export function ewmaIrregular(points: readonly DatedValue[], alpha: number, periodDays: number): DatedValue[] {
  const out: DatedValue[] = [];
  let prev: { t: number; v: number } | null = null;
  for (const p of points) {
    const t = dayNumber(p.date);
    if (prev === null) {
      prev = { t, v: p.value };
    } else {
      const dt = Math.max(0, t - prev.t);
      const a = dt === 0 ? alpha : 1 - (1 - alpha) ** (dt / periodDays);
      prev = { t, v: prev.v + a * (p.value - prev.v) };
    }
    out.push({ date: p.date, value: prev.v });
  }
  return out;
}

/**
 * Trailing moving average over a calendar window (default 7 days, inclusive),
 * only emitted when at least `minObs` observations fall in the window.
 */
export function movingAverage(points: readonly DatedValue[], windowDays = 7, minObs = 4): DatedValue[] {
  const out: DatedValue[] = [];
  for (let k = 0; k < points.length; k++) {
    const t = dayNumber(points[k].date);
    const win = points.filter((p, j) => j <= k && t - dayNumber(p.date) < windowDays);
    if (win.length >= minObs) {
      out.push({ date: points[k].date, value: win.reduce((s, p) => s + p.value, 0) / win.length });
    }
  }
  return out;
}
