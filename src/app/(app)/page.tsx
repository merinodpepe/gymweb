import { DbMissing, hasDatabase } from "@/components/db-missing";
import { BodyForm } from "@/components/forms/body-form";
import { KpiCard } from "@/components/kpi-card";
import { ProgressBar } from "@/components/progress-bar";
import { normalizeRange, RangeTabs } from "@/components/range-tabs";
import { TimeChart } from "@/components/time-chart";
import { TrendBadge } from "@/components/trend-badge";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { formatPace } from "@/domain/stats/pace";
import { fmt, fmtDate, fmtSigned } from "@/lib/format";
import { goals } from "@/lib/goals";
import { mergeSeries } from "@/lib/series";
import { getDashboard } from "@/services/dashboardService";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const range = normalizeRange((await searchParams).range);
  if (!hasDatabase())
    return (
      <>
        <PageHeader title="Dashboard" />
        <DbMissing />
      </>
    );

  const d = await getDashboard(range);
  const { weight, steps, runs } = d;
  const weekKm = runs.week.outdoor.distance_km + runs.week.treadmill.distance_km;
  const weightRows = mergeSeries({ raw: weight.raw, ewma: weight.ewma, ma7: weight.ma7 });
  const stepRows = mergeSeries({ steps: steps.series });

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Hoy es ${fmtDate(d.today)}`}>
        <RangeTabs current={range} basePath="/" />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Peso actual"
          value={fmt(weight.current?.value, 1)}
          unit="kg"
          detail={weight.current ? fmtDate(weight.current.date, { year: false }) : "Sin pesaje hoy ni ayer"}
        />
        <KpiCard
          label="Tendencia 28 d"
          value={weight.trend ? fmtSigned(weight.trend.slope, 2) : "—"}
          unit="kg/sem"
          detail={
            weight.trend
              ? `IC 95 %: ${fmtSigned(weight.trend.ci95[0], 2)} a ${fmtSigned(weight.trend.ci95[1], 2)}`
              : "Mínimo 5 pesajes en 28 días"
          }
        >
          <TrendBadge label={weight.label} goodWhen="none" />
        </KpiCard>
        <KpiCard
          label="Pasos hoy"
          value={steps.today === null ? "—" : fmt(steps.today, 0)}
          detail={
            steps.mean7 === null ? "Sin datos esta semana" : `Media 7 d: ${fmt(steps.mean7, 0)} (${steps.days7} días con dato)`
          }
        />
        <KpiCard
          label="Última carrera"
          value={runs.last ? fmt(runs.last.distance_km, 2) : "—"}
          unit="km"
          detail={
            runs.last
              ? `${fmtDate(runs.last.date, { year: false })} · ${formatPace(runs.last.duration_s / runs.last.distance_km)} · ${runs.last.surface === "outdoor" ? "exterior" : "cinta"}`
              : "Aún no hay carreras"
          }
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Peso corporal</CardTitle>
          <p className="mb-3 text-xs text-muted">Pesajes en puntos, tendencia EWMA (α 0,1) y media móvil de 7 días.</p>
          {weight.raw.length ? (
            <TimeChart
              ariaLabel="Gráfica de peso corporal"
              data={weightRows}
              unit="kg"
              series={[
                { key: "raw", label: "Pesaje", color: "var(--chart-raw)", kind: "dots" },
                { key: "ma7", label: "Media 7 d", color: "var(--chart-secondary)", kind: "line", dashed: true },
                { key: "ewma", label: "Tendencia (EWMA)", color: "var(--accent)", kind: "line" },
              ]}
            />
          ) : (
            <EmptyState>Registra tu primer pesaje abajo.</EmptyState>
          )}
        </Card>

        <Card>
          <CardTitle>Esta semana</CardTitle>
          <div className="mt-4 space-y-4">
            <ProgressBar label="Media de pasos" value={steps.mean7 ?? 0} goal={goals.steps} unit="pasos" />
            <ProgressBar label="Km corridos" value={weekKm} goal={goals.weeklyRunKm} unit="km" />
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            {(["outdoor", "treadmill"] as const).map((s) => (
              <div key={s} className="rounded-md border border-border p-3">
                <dt className="text-xs uppercase tracking-wide text-muted">{s === "outdoor" ? "Exterior" : "Cinta"}</dt>
                <dd className="mt-1 text-strong num">
                  {runs.week[s].count} · {fmt(runs.week[s].distance_km, 1)} km
                </dd>
                <dd className="text-xs text-muted num">{formatPace(runs.week[s].pace_s_per_km)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle>Registrar peso y pasos</CardTitle>
        <p className="mb-4 text-xs text-muted">Si ya hay datos ese día, solo se sobrescriben los campos que rellenes.</p>
        <BodyForm today={d.today} />
      </Card>

      <Card className="mt-6">
        <CardTitle>Pasos</CardTitle>
        <p className="mb-3 text-xs text-muted">
          Los días sin dato no cuentan como 0. Mediana {fmt(steps.p50, 0)} · P25 {fmt(steps.p25, 0)} · P75 {fmt(steps.p75, 0)}.
        </p>
        {steps.series.length ? (
          <TimeChart
            ariaLabel="Gráfica de pasos diarios"
            data={stepRows}
            unit="pasos"
            digits={0}
            zeroBased
            height={200}
            series={[{ key: "steps", label: "Pasos", color: "var(--accent)", kind: "bar" }]}
          />
        ) : (
          <EmptyState>Aún no hay pasos registrados.</EmptyState>
        )}
      </Card>
    </>
  );
}
