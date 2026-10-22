"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart as RScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

export interface ScatterPoint {
  x: number;
  y: number;
  label: string;
}

const nf = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

/** Plain scatter plot of (x, y) pairs; every point shows its own label on hover. */
export function ScatterPlot({
  points,
  xLabel,
  yLabel,
  xUnit,
  yUnit,
  height = 240,
  ariaLabel,
}: {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  xUnit: string;
  yUnit: string;
  height?: number;
  ariaLabel: string;
}) {
  const TooltipBox = ({ active, payload }: TooltipContentProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as ScatterPoint;
    return (
      <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg">
        <p className="mb-1 font-medium text-strong">{p.label}</p>
        <p className="num text-text">
          {xLabel}: {nf.format(p.x)} {xUnit}
        </p>
        <p className="num text-text">
          {yLabel}: {nf.format(p.y)} {yUnit}
        </p>
      </div>
    );
  };

  return (
    <figure aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RScatterChart margin={{ top: 8, right: 12, bottom: 20, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            stroke="var(--border)"
            tickLine={false}
            domain={["auto", "auto"]}
            label={{ value: `${xLabel} (${xUnit})`, position: "insideBottom", offset: -12, fill: "var(--text-muted)", fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yLabel}
            width={48}
            stroke="var(--border)"
            tickLine={false}
            axisLine={false}
            domain={["auto", "auto"]}
          />
          <Tooltip content={(p) => <TooltipBox {...(p as TooltipContentProps<number, string>)} />} cursor={{ stroke: "var(--text-muted)", strokeDasharray: "3 3" }} />
          <Scatter data={points} fill="var(--accent)" isAnimationActive={false} />
        </RScatterChart>
      </ResponsiveContainer>
    </figure>
  );
}
