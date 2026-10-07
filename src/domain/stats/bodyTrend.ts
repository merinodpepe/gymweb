import { ewmaIrregular, movingAverage, type DatedValue } from "./ewma";
import { olsFit, trendLabel, type LinearFit, type TrendLabel } from "./regression";
import { mean, quantile } from "./util";
import { addDays, dayNumber } from "./weeks";

export const WEIGHT_ALPHA = 0.1;
export const WEIGHT_TREND_DAYS = 28;
export const WEIGHT_TREND_MIN_OBS = 5;
export const WEIGHT_MIN_ABS_SLOPE = 0.1; // kg/week

export interface WeightAnalysis {
  raw: DatedValue[];
  ewma: DatedValue[];
  ma7: DatedValue[];
  /** Today's weigh-in, else yesterday's; with its date. */
  current: DatedValue | null;
  /** kg/week over the last 28 days. */
  trend: LinearFit | null;
  label: TrendLabel | null;
}

export function analyzeWeight(raw: readonly DatedValue[], today: string): WeightAnalysis {
  const sorted = [...raw].sort((a, b) => a.date.localeCompare(b.date));
  const yesterday = addDays(today, -1);
  const current =
    sorted.find((p) => p.date === today) ?? sorted.find((p) => p.date === yesterday) ?? null;

  const t0 = dayNumber(today);
  const recent = sorted.filter((p) => t0 - dayNumber(p.date) < WEIGHT_TREND_DAYS && p.date <= today);
  let trend: LinearFit | null = null;
  if (recent.length >= WEIGHT_TREND_MIN_OBS) {
    trend = olsFit(
      recent.map((p) => (dayNumber(p.date) - t0) / 7),
      recent.map((p) => p.value),
    );
  }
  return {
    raw: sorted,
    ewma: ewmaIrregular(sorted, WEIGHT_ALPHA, 1),
    ma7: movingAverage(sorted, 7, 4),
    current,
    trend,
    label: trend ? trendLabel(trend.ci95, trend.slope, WEIGHT_MIN_ABS_SLOPE) : null,
  };
}

export interface StepsAnalysis {
  today: number | null;
  /** Mean of the days WITH data in the last 7 days (missing days are not 0). */
  mean7: number | null;
  days7: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
}

export function analyzeSteps(raw: readonly DatedValue[], today: string): StepsAnalysis {
  const t0 = dayNumber(today);
  const last7 = raw.filter((p) => t0 - dayNumber(p.date) < 7 && p.date <= today).map((p) => p.value);
  const all = raw.map((p) => p.value);
  return {
    today: raw.find((p) => p.date === today)?.value ?? null,
    mean7: last7.length ? mean(last7) : null,
    days7: last7.length,
    p25: all.length ? quantile(all, 0.25) : null,
    p50: all.length ? quantile(all, 0.5) : null,
    p75: all.length ? quantile(all, 0.75) : null,
  };
}
