export interface DatedValue {
  date: string;
  value: number;
}

export type ChartRow = { date: string; t: number } & Record<string, number | string | null>;

/** Merges several dated series into rows keyed by date, for a shared time axis. */
export function mergeSeries(series: Record<string, readonly DatedValue[]>): ChartRow[] {
  const map = new Map<string, ChartRow>();
  for (const [key, pts] of Object.entries(series)) {
    for (const p of pts) {
      const d = p.date.slice(0, 10);
      let row = map.get(d);
      if (!row) {
        row = { date: d, t: Date.parse(`${d}T12:00:00Z`) } as ChartRow;
        map.set(d, row);
      }
      row[key] = p.value;
    }
  }
  const keys = Object.keys(series);
  const rows = [...map.values()].sort((a, b) => a.t - b.t);
  for (const r of rows) for (const k of keys) if (!(k in r)) r[k] = null;
  return rows;
}
