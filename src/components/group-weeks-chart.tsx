"use client";

import { Bar, BarChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";

export interface GroupWeekBar {
  /** Short label (e.g. "12 oct"). */
  label: string;
  sets: number;
  partial: boolean;
}

/** Sets per week of one muscle group with the Coach's target range shaded. */
export function GroupWeeksChart({
  group,
  data,
  min,
  max,
}: {
  group: string;
  data: GroupWeekBar[];
  min: number;
  max: number;
}) {
  const TooltipBox = ({ active, payload }: TooltipContentProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as GroupWeekBar;
    return (
      <div className="rounded-md border border-border bg-surface px-2 py-1 text-xs shadow-lg">
        <p className="font-medium text-strong">Semana del {p.label}{p.partial ? " (parcial)" : ""}</p>
        <p className="num text-text">{p.sets} series</p>
      </div>
    );
  };
  const top = Math.max(max * 1.25, ...data.map((d) => d.sets));
  return (
    <figure aria-label={`${group}: series por semana frente al objetivo ${min} a ${max}`} style={{ height: 120 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <ReferenceArea y1={min} y2={max} fill="var(--good)" fillOpacity={0.18} ifOverflow="extendDomain" />
          <XAxis dataKey="label" stroke="var(--border)" tickLine={false} fontSize={10} interval="preserveStartEnd" />
          <YAxis width={28} stroke="var(--border)" tickLine={false} axisLine={false} fontSize={10} domain={[0, Math.ceil(top)]} allowDecimals={false} />
          <Tooltip content={(p) => <TooltipBox {...(p as TooltipContentProps<number, string>)} />} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="sets" fill="var(--accent)" radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
