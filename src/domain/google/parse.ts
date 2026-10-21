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

export interface BodyDay {
  date: string;
  steps: number | null;
}

/** Steps to write: only when Google's total is higher than the stored one (the current day grows through the day). */
export function planStepUpdates(stored: readonly BodyDay[], steps: readonly DailySteps[]): DailySteps[] {
  const by = new Map(stored.map((s) => [s.date, s.steps]));
  return steps.filter((s) => s.steps > (by.get(s.date) ?? -1)).sort((a, b) => a.date.localeCompare(b.date));
}
