import type { Consistency } from "@/domain/stats/consistency";
import { fmt, fmtShortDate } from "@/lib/format";
import { KpiCard } from "./kpi-card";

const DAYS = ["L", "M", "X", "J", "V", "S", "D"];

export function ConsistencyKpis({ c }: { c: Consistency }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        label="Racha"
        value={String(c.current_streak)}
        unit={c.current_streak === 1 ? "semana" : "semanas"}
        detail={`Récord: ${c.longest_streak} · semanas seguidas cumpliendo el objetivo`}
      />
      <KpiCard
        label="Esta semana"
        value={String(c.workouts_this_week)}
        unit={`/ ${c.target_this_week} entrenos`}
        detail={`${Math.min(100, Math.round((c.workouts_this_week / c.target_this_week) * 100))}% de la semana`}
      />
      <KpiCard label="Media semanal" value={fmt(c.avg_per_week, 1)} unit="días/sem" detail={`${c.total_workouts} días de entreno en total`} />
      <KpiCard label="Constancia media" value={String(c.score)} unit="%" detail="Media del % de cada semana (100% = 3 entrenos; 4 desde el 19/10/2026)" />
    </div>
  );
}

/** GitHub-style grid: one column per week (Monday first), one square per day. */
export function WorkoutHeatmap({ weeks }: { weeks: Consistency["heatmap"] }) {
  const trained = weeks.reduce((n, w) => n + w.days.filter(Boolean).length, 0);
  return (
    <div
      className="flex gap-1 overflow-x-auto pb-1"
      role="img"
      aria-label={`${trained} días de entreno en las últimas ${weeks.length} semanas`}
    >
      <div aria-hidden className="grid grid-rows-7 gap-1 pr-1 text-[10px] leading-none text-muted">
        {DAYS.map((d) => (
          <span key={d} className="flex size-3.5 items-center">
            {d}
          </span>
        ))}
      </div>
      {weeks.map((w) => (
        <div key={w.week_start} className="grid grid-rows-7 gap-1">
          {w.days.map((on, i) => (
            <span
              key={i}
              title={on ? `Entreno · semana del ${fmtShortDate(w.week_start)}` : undefined}
              className={on ? "size-3.5 rounded-sm bg-good" : "size-3.5 rounded-sm bg-surface-2"}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
