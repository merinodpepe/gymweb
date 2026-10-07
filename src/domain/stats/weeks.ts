const DAY_MS = 86_400_000;

/** Days since epoch for a `YYYY-MM-DD` (or `YYYY-MM-DDTHH:mm`) string, as a float. */
export function dayNumber(iso: string): number {
  const [d, t] = iso.split("T");
  const base = Date.parse(`${d}T00:00:00Z`) / DAY_MS;
  if (!t) return base;
  const [h, m] = t.split(":").map(Number);
  return base + (h * 60 + m) / 1440;
}

export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

export function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) + n * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Monday (YYYY-MM-DD) of the ISO week containing `iso`. */
export function isoWeekStart(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(iso, -dow);
}

/** ISO week label, e.g. `2025-W41`. */
export function isoWeekKey(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow + 3); // Thursday decides the year
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / DAY_MS - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export const APP_TIME_ZONE = process.env.APP_TIME_ZONE ?? "Europe/Madrid";

/** Today's date in the app's time zone (servers run in UTC). */
export function todayIso(now: Date = new Date(), timeZone = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
