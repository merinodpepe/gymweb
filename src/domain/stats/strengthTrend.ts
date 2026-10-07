import { ewmaIrregular, type DatedValue } from "./ewma";
import { olsFit, trendLabel, type LinearFit, type TrendLabel } from "./regression";
import { theilSen, type TheilSenFit } from "./theilSen";
import { sd } from "./util";
import { dayNumber } from "./weeks";

export const STRENGTH_ALPHA = 0.3;
export const TREND_WINDOW_WEEKS = 12;
export const MIN_SESSIONS_FOR_SLOPE = 4;
export const MIN_SESSIONS_FOR_TREND = 3;

export interface StrengthTrend {
  points: DatedValue[]; // one e1RM per session
  ewma: DatedValue[];
  /** kg/week over the last 12 weeks; null if < 4 sessions in that window. */
  theilSen: TheilSenFit | null;
  ols: LinearFit | null;
  label: TrendLabel | null;
  /** SD of consecutive detrended differences (kg). */
  typicalError: number | null;
  /** Dates whose jump vs the previous session exceeds 1.5 × typical error. */
  realJumps: string[];
}

const toWeeks = (date: string, origin: number) => (dayNumber(date) - origin) / 7;

export function strengthTrend(points: readonly DatedValue[]): StrengthTrend {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const result: StrengthTrend = {
    points: sorted,
    ewma: [],
    theilSen: null,
    ols: null,
    label: null,
    typicalError: null,
    realJumps: [],
  };
  if (sorted.length < MIN_SESSIONS_FOR_TREND) return result;

  result.ewma = ewmaIrregular(sorted, STRENGTH_ALPHA, 7);

  const last = dayNumber(sorted[sorted.length - 1].date);
  const window = sorted.filter((p) => last - dayNumber(p.date) <= TREND_WINDOW_WEEKS * 7);
  if (window.length >= MIN_SESSIONS_FOR_SLOPE) {
    const origin = dayNumber(window[0].date);
    const xs = window.map((p) => toWeeks(p.date, origin));
    const ys = window.map((p) => p.value);
    result.theilSen = theilSen(xs, ys);
    result.ols = olsFit(xs, ys);
    if (result.theilSen) result.label = trendLabel(result.theilSen.ci95, result.theilSen.slope);
  }

  // Smallest worthwhile change: detrend with the global Theil-Sen line.
  const origin = dayNumber(sorted[0].date);
  const xsAll = sorted.map((p) => toWeeks(p.date, origin));
  const fitAll = theilSen(xsAll, sorted.map((p) => p.value), { resamples: 0 });
  if (fitAll) {
    const resid = sorted.map((p, i) => p.value - (fitAll.intercept + fitAll.slope * xsAll[i]));
    const diffs = resid.slice(1).map((r, i) => r - resid[i]);
    const te = sd(diffs);
    if (Number.isFinite(te) && te > 0) {
      result.typicalError = te;
      for (let i = 1; i < sorted.length; i++) {
        if (Math.abs(sorted[i].value - sorted[i - 1].value) > 1.5 * te) result.realJumps.push(sorted[i].date);
      }
    }
  }
  return result;
}
