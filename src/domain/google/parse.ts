/** Parsers for Google Health API responses (https://developers.google.com/health/reference/rest/v4). */

interface CivilDate {
  year?: number;
  month?: number;
  day?: number;
}
export interface CivilDateTime {
  date?: CivilDate;
  time?: { hours?: number; minutes?: number };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function civilToIso(c: CivilDateTime | undefined): string | null {
  const d = c?.date;
  if (!d?.year || !d.month || !d.day) return null;
  return `${d.year}-${pad(d.month)}-${pad(d.day)}`;
}

export function isoToCivil(iso: string): CivilDateTime {
  const [year, month, day] = iso.split("-").map(Number);
  return { date: { year, month, day } };
}

export interface DailySteps {
  date: string;
  steps: number;
}

/** `dataPoints:dailyRollUp` response for steps. 64-bit counts arrive as strings. */
export function parseStepsRollup(body: unknown): { days: DailySteps[]; unreadable: number } {
  const points = (body as { rollupDataPoints?: unknown[] } | null)?.rollupDataPoints ?? [];
  const days: DailySteps[] = [];
  let unreadable = 0;
  for (const p of points as { civilStartTime?: CivilDateTime; steps?: Record<string, unknown> }[]) {
    const date = civilToIso(p.civilStartTime);
    const raw = p.steps?.countSum ?? p.steps?.count_sum ?? p.steps?.count;
    const steps = Number(raw);
    if (!date || raw === undefined || !Number.isFinite(steps) || steps < 0) unreadable++;
    else days.push({ date, steps: Math.round(steps) });
  }
  return { days, unreadable };
}

export interface DailyWeight {
  date: string;
  weight_kg: number;
}

/** `dataPoints.list` response for weight: the latest sample of each civil day, in kg. */
export function parseWeightPoints(body: unknown): { days: DailyWeight[]; unreadable: number } {
  const points = (body as { dataPoints?: unknown[] } | null)?.dataPoints ?? [];
  const latest = new Map<string, { at: string; kg: number }>();
  let unreadable = 0;
  for (const p of points as {
    weight?: { weightGrams?: number | string; sampleTime?: { physicalTime?: string; civilTime?: CivilDateTime } };
  }[]) {
    const date = civilToIso(p.weight?.sampleTime?.civilTime);
    const grams = Number(p.weight?.weightGrams);
    if (!date || !Number.isFinite(grams) || grams <= 0) {
      unreadable++;
      continue;
    }
    const at = p.weight?.sampleTime?.physicalTime ?? "";
    const prev = latest.get(date);
    if (!prev || at > prev.at) latest.set(date, { at, kg: Math.round(grams / 10) / 100 });
  }
  return { days: [...latest].map(([date, v]) => ({ date, weight_kg: v.kg })).sort((a, b) => a.date.localeCompare(b.date)), unreadable };
}

export interface BodyDay {
  date: string;
  weight_kg: number | null;
  steps: number | null;
}

/**
 * What to write: weight only for days with no weigh-in yet (never overwrites a manual one);
 * steps when Google's total is higher than the stored one (the current day grows through the day).
 */
export function planBodyUpdates(
  stored: readonly BodyDay[],
  steps: readonly DailySteps[],
  weights: readonly DailyWeight[],
): { date: string; weight_kg?: number; steps?: number }[] {
  const by = new Map(stored.map((s) => [s.date, s]));
  const out = new Map<string, { date: string; weight_kg?: number; steps?: number }>();
  const slot = (date: string) => out.get(date) ?? out.set(date, { date }).get(date)!;
  for (const s of steps) if (s.steps > (by.get(s.date)?.steps ?? -1)) slot(s.date).steps = s.steps;
  for (const w of weights) if (by.get(w.date)?.weight_kg == null) slot(w.date).weight_kg = w.weight_kg;
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
}
