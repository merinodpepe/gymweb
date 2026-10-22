import type { WeekdayStep } from "@/domain/insights/charts";
import { fmt } from "@/lib/format";

/** Mean (bar) and median (tick) steps per weekday; the goal is marked on the scale. */
export function WeekdaySteps({ days, goal }: { days: WeekdayStep[]; goal: number }) {
  const top = Math.max(goal * 1.2, ...days.map((d) => d.mean ?? 0));
  const pct = (v: number) => `${Math.min(100, (v / top) * 100)}%`;
  return (
    <ul className="space-y-2" aria-label="Pasos por día de la semana">
      {days.map((d) => (
        <li key={d.weekday} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-sm">
          <span className="text-muted">{d.weekday}</span>
          <div className="relative h-3 rounded-full bg-surface-2" role="img" aria-label={d.mean === null ? `${d.weekday}: sin datos` : `${d.weekday}: media ${fmt(d.mean, 0)} pasos, mediana ${fmt(d.median, 0)}`}>
            {d.mean !== null && <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: pct(d.mean) }} />}
            {d.median !== null && <span className="absolute inset-y-[-2px] w-0.5 bg-strong" style={{ left: pct(d.median) }} />}
            <span className="absolute inset-y-[-3px] w-px border-l border-dashed border-good" style={{ left: pct(goal) }} />
          </div>
          <span className="w-28 text-right text-xs text-muted num">
            {d.mean === null ? "—" : `${fmt(d.mean, 0)} · ${Math.round((d.above_goal ?? 0) * 100)} % ≥ meta`}
          </span>
        </li>
      ))}
      <li className="pt-1 text-xs text-muted">
        Barra = media · marca blanca = mediana · línea verde = meta de {fmt(goal, 0)} pasos. Los días sin dato no cuentan como 0.
      </li>
    </ul>
  );
}
