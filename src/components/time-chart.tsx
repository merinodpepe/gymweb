"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { ChartRow } from "@/lib/series";

export interface SeriesSpec {
  key: string;
  label: string;
  /** CSS colour (use a token, e.g. var(--accent)). */
  color: string;
  kind: "line" | "dots" | "bar";
  dashed?: boolean;
}

const shortDate = (t: number) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(t));
const longDate = (t: number) =>
  new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(t),
  );

function Swatch({ s }: { s: SeriesSpec }) {
  if (s.kind === "dots") return <span className="inline-block size-2.5 rounded-full" style={{ background: s.color }} />;
  if (s.kind === "bar") return <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />;
  return (
    <span
      className="inline-block w-4 border-t-2"
      style={{ borderColor: s.color, borderStyle: s.dashed ? "dashed" : "solid" }}
    />
  );
}

export function TimeChart({
  data,
  series,
  unit,
  digits = 1,
  height = 260,
  ariaLabel,
  zeroBased = false,
  format = "number",
}: {
  data: ChartRow[];
  series: SeriesSpec[];
  unit: string;
  digits?: number;
  height?: number;
  ariaLabel: string;
  zeroBased?: boolean;
  /** "pace": values are seconds per km, shown as m:ss. */
  format?: "number" | "pace";
}) {
  const fmt = (v: number) => {
    if (format === "pace") {
      const s = Math.round(v);
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }
    return new Intl.NumberFormat("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
  };

  const TooltipBox = ({ active, payload, label }: TooltipContentProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as ChartRow;
    return (
      <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg">
        <p className="mb-1 font-medium text-strong">{longDate(Number(label))}</p>
        {series.map((s) =>
          row[s.key] === null || row[s.key] === undefined ? null : (
            <p key={s.key} className="flex items-center gap-2 text-text">
              <Swatch s={s} />
              <span>{s.label}</span>
              <span className="ml-auto pl-3 font-medium text-strong num">
                {fmt(Number(row[s.key]))} {unit}
              </span>
            </p>
          ),
        )}
      </div>
    );
  };

  return (
    <figure aria-label={ariaLabel}>
      {series.length > 1 && (
        <figcaption className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <Swatch s={s} />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={shortDate}
              stroke="var(--border)"
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              width={48}
              stroke="var(--border)"
              tickLine={false}
              axisLine={false}
              domain={zeroBased ? [0, "auto"] : ["auto", "auto"]}
              reversed={format === "pace"}
              tickFormatter={(v: number) => fmt(v).replace(/,0+$/, "")}
            />
            <Tooltip
              content={(p) => <TooltipBox {...(p as TooltipContentProps<number, string>)} />}
              cursor={{ stroke: "var(--text-muted)", strokeDasharray: "3 3" }}
            />
            {series.map((s) =>
              s.kind === "bar" ? (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  fill={s.color}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={18}
                  isAnimationActive={false}
                />
              ) : s.kind === "dots" ? (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  stroke="none"
                  dot={{ r: 3, fill: s.color, stroke: "var(--surface)", strokeWidth: 1 }}
                  activeDot={{ r: 5, fill: s.color, stroke: "var(--surface)", strokeWidth: 2 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              ) : (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? "5 4" : undefined}
                  dot={false}
                  activeDot={{ r: 4, fill: s.color, stroke: "var(--surface)", strokeWidth: 2 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ),
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
