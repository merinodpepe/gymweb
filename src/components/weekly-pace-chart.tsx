"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  type TooltipContentProps,
} from "recharts";
import type { WeeklyPacePoint } from "@/domain/insights/charts";

const pace = (s: number) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;
const week = (t: number) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(t));

interface Row extends WeeklyPacePoint {
  t: number;
}

/** Weighted pace per week (faster = higher); dot size = elevation gain of the week. */
export function WeeklyPaceChart({ points, ariaLabel }: { points: WeeklyPacePoint[]; ariaLabel: string }) {
  const data: Row[] = points.map((p) => ({ ...p, t: Date.parse(`${p.week_start}T12:00:00Z`) }));
  const TooltipBox = ({ active, payload }: TooltipContentProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as Row;
    return (
      <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg">
        <p className="mb-1 font-medium text-strong">Semana del {week(p.t)}</p>
        <p className="num text-text">Ritmo {pace(p.pace)} /km</p>
        <p className="num text-text">{p.km} km · {p.elevation_m} m de desnivel</p>
      </div>
    );
  };
  return (
    <figure aria-label={ariaLabel} style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={week} stroke="var(--border)" tickLine={false} minTickGap={28} />
          <YAxis dataKey="pace" type="number" reversed width={48} stroke="var(--border)" tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={pace} />
          <ZAxis dataKey="elevation_m" range={[40, 260]} />
          <Tooltip content={(p) => <TooltipBox {...(p as TooltipContentProps<number, string>)} />} cursor={{ stroke: "var(--text-muted)", strokeDasharray: "3 3" }} />
          <Scatter data={data} fill="var(--accent)" fillOpacity={0.85} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </figure>
  );
}
