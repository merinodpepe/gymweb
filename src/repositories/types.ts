/** Postgres numeric columns arrive as strings. */
export const toNum = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

export interface DateRange {
  from?: string; // inclusive YYYY-MM-DD
  to?: string; // inclusive YYYY-MM-DD
}
