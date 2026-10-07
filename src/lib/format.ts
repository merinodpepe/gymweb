const nf = (digits: number) =>
  new Intl.NumberFormat("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function fmt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return nf(digits).format(n);
}

/** Weights keep their real precision: 45 → "45", 43.75 → "43,75". */
export function fmtKg(n: number): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n);
}

export function fmtSigned(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : n < 0 ? "−" : "±"}${nf(digits).format(Math.abs(n))}`;
}

/** "2025-10-07" or "2025-10-07T18:32" → "mar, 7 oct 2025". */
export function fmtDate(iso: string | null | undefined, opts: { year?: boolean; time?: boolean } = {}): string {
  if (!iso) return "—";
  const [d, t] = iso.split("T");
  const date = new Date(`${d}T12:00:00Z`);
  const s = new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: opts.year === false ? undefined : "numeric",
    timeZone: "UTC",
  }).format(date);
  return opts.time && t ? `${s}, ${t.slice(0, 5)}` : s;
}

export function fmtShortDate(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso.slice(0, 10)}T12:00:00Z`),
  );
}
