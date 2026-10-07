import { addDays, todayIso } from "@/domain/stats/weeks";

/** "90d" | "6m" | "1y" | "all" → inclusive date range ending today. */
export function parseRange(range: string | null | undefined, fallback = "90d") {
  const today = todayIso();
  const r = range ?? fallback;
  const m = /^(\d+)([dwmy])$/.exec(r);
  if (!m) return { today, from: undefined as string | undefined, to: today };
  const n = Number(m[1]);
  const days = { d: 1, w: 7, m: 30, y: 365 }[m[2] as "d" | "w" | "m" | "y"] * n;
  return { today, from: addDays(today, -days + 1), to: today };
}
