import type { CalendarDay, CalendarMonth } from "@/domain/insights/charts";
import { cn } from "@/lib/cn";
import { fmt } from "@/lib/format";

const HEAD = ["L", "M", "X", "J", "V", "S", "D"];
const LEVEL: Record<CalendarDay["level"], string> = {
  0: "bg-surface-2 text-muted",
  1: "bg-accent/25 text-strong",
  2: "bg-accent/45 text-strong",
  3: "bg-accent/70 text-accent-ink",
  4: "bg-accent text-accent-ink",
};

const monthName = (m: string) =>
  new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T12:00:00Z`));

/** Month grids (Monday first); colour = tonnage quartile of the training day, rest days in grey. */
export function VolumeCalendar({ months }: { months: CalendarMonth[] }) {
  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {months.map((m) => (
          <figure key={m.month} aria-label={`Calendario de ${monthName(m.month)}`}>
            <figcaption className="mb-2 font-display text-sm capitalize text-strong">{monthName(m.month)}</figcaption>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted" aria-hidden>
              {HEAD.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <ol className="mt-1 grid grid-cols-7 gap-1">
              {Array.from({ length: m.offset }, (_, i) => (
                <li key={`b${i}`} aria-hidden />
              ))}
              {m.days.map((d) => (
                <li
                  key={d.date}
                  title={
                    d.tonnage === null
                      ? undefined
                      : `${d.date} · ${d.routines.join(", ")} · ${fmt(d.tonnage, 0)} kg`
                  }
                  className={cn("flex aspect-square items-center justify-center rounded-sm text-[11px] num", LEVEL[d.level])}
                >
                  {d.day}
                  {d.tonnage !== null && <span className="sr-only"> entreno, {fmt(d.tonnage, 0)} kilos de volumen</span>}
                </li>
              ))}
            </ol>
          </figure>
        ))}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        Volumen del día:
        {([1, 2, 3, 4] as const).map((l) => (
          <span key={l} className={cn("inline-block size-3.5 rounded-sm", LEVEL[l].split(" ")[0])} />
        ))}
        <span>(de menos a más tonelaje; por cuartiles de los días mostrados)</span>
      </p>
    </div>
  );
}
