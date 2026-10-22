import { DbMissing, hasDatabase } from "@/components/db-missing";
import { BodyForm } from "@/components/forms/body-form";
import { MeasuresForm } from "@/components/forms/measures-form";
import { StepsForm } from "@/components/forms/steps-form";
import { AlertsCard } from "@/components/alerts-card";
import { KpiCard } from "@/components/kpi-card";
import { ProgressBar } from "@/components/progress-bar";
import { normalizeRange, RangeTabs } from "@/components/range-tabs";
import { TimeChart } from "@/components/time-chart";
import { TrendBadge } from "@/components/trend-badge";
import { WeekdaySteps } from "@/components/weekday-steps";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { weekdayProfile } from "@/domain/insights/charts";
import { formatPace } from "@/domain/stats/pace";
import { fmt, fmtDate, fmtSigned } from "@/lib/format";
import { goals } from "@/lib/goals";
import { mergeSeries } from "@/lib/series";
import { getDashboard } from "@/services/dashboardService";
import { getAlerts } from "@/services/insightsService";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const range = normalizeRange((await searchParams).range);
  if (!hasDatabase())
    return (
      <>
        <PageHeader title="Dashboard" />
        <DbMissing />
      </>
    );

  const [d, alerts] = await Promise.all([getDashboard(range), getAlerts().catch(() => [])]);
  const { weight, steps, runs } = d;
  const weekKm = runs.week.outdoor.distance_km + runs.week.treadmill.distance_km;
  const weightRows = mergeSeries({ raw: weight.raw, ewma: weight.ewma, ma7: weight.ma7 });
  const stepRows = mergeSeries({ steps: steps.series });
  const changeRows = mergeSeries({ change: weight.weeklyChange });
  const { measures } = d;
  const hasMeasures = measures.waist.length + measures.arm.length + measures.energy.length > 0;
  const measureRows = mergeSeries({ waist: measures.waist, arm: measures.arm });
  const energyRows = mergeSeries({ energy: measures.energy });
  const weekdays = weekdayProfile(steps.series, goals.steps);

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
          detail={
            weight.current
              ? `${fmtDate(weight.current.date, { year: false })}${weight.currentScale ? ` · ${weight.currentScale}, corregido` : ""}`
              : "Sin pesaje hoy ni ayer"
          }
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

      <AlertsCard alerts={alerts} className="mt-6" />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Peso corporal</CardTitle>
          <p className="mb-3 text-xs text-muted">
            Pesajes tal cual en puntos; tendencia EWMA (α 0,1) y media móvil de 7 días corregidas a la media de tus básculas.
          </p>
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

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Registrar peso</CardTitle>
          <p className="mb-4 text-xs text-muted">Si ya hay un pesaje ese día, se sobrescribe; los pasos del día no se tocan.</p>
          <BodyForm today={d.today} scales={d.scaleNames} />
        </Card>
        <Card>
          <CardTitle>Registrar pasos</CardTitle>
          <p className="mb-4 text-xs text-muted">Se guarda aparte: no hace falta repetir el pesaje del día.</p>
          <StepsForm today={d.today} />
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle>Energía y medidas</CardTitle>
        <p className="mb-4 text-xs text-muted">
          Opcional. Cintura y brazo para no depender solo del peso; la energía del día (1 agotado, 10 genial) para cruzarla con el
          entreno. No toca el peso ni los pasos del día.
        </p>
        <MeasuresForm today={d.today} />
        {hasMeasures && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {measures.waist.length + measures.arm.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-muted">Medidas (cm)</p>
                <TimeChart
                  ariaLabel="Cintura y brazo"
                  data={measureRows}
                  unit="cm"
                  height={200}
                  series={[
                    { key: "waist", label: "Cintura", color: "var(--accent)", kind: "dots" },
                    { key: "arm", label: "Brazo", color: "var(--chart-secondary)", kind: "dots" },
                  ]}
                />
              </div>
            )}
            {measures.energy.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-muted">Energía (1-10)</p>
                <TimeChart
                  ariaLabel="Energía del día"
                  data={energyRows}
                  unit="/10"
                  digits={0}
                  zeroBased
                  height={200}
                  series={[{ key: "energy", label: "Energía", color: "var(--accent)", kind: "bar" }]}
                />
              </div>
            )}
          </div>
        )}
      </Card>

      {weight.scales.length > 0 && (
        <Card className="mt-6">
          <CardTitle>Básculas</CardTitle>
          <p className="mb-3 text-xs text-muted">
            Cuánto marca cada báscula respecto a la media de todas, comparando pesajes de días cercanos (≤ 3 días) y
            descontando lo que cambia tu peso entre ellos. Últimos 180 días.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {weight.scales.map((s) => (
              <li key={s.scale} className="rounded-md border border-border p-3">
                <p className="font-display text-strong">{s.scale}</p>
                {s.offset === null ? (
                  <p className="text-sm text-muted">
                    Sin calibrar: pésate en otra báscula en los días cercanos ({s.weighIns} pesajes).
                  </p>
                ) : (
                  <>
                    <p className="text-strong num">
                      {fmtSigned(s.offset, 2)} kg{s.ci95 !== null && <span className="text-muted"> ± {fmt(s.ci95, 2)}</span>}
                    </p>
                    <p className="text-xs text-muted">
                      {Math.abs(s.offset) < 0.05 ? "Marca como la media" : s.offset > 0 ? "Marca de más" : "Marca de menos"} ·{" "}
                      {s.pairs} pares · confianza {s.confidence}
                    </p>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {weight.weeklyChange.length > 0 && (
        <Card className="mt-6">
          <CardTitle>Cambio de peso por semana</CardTitle>
          <p className="mb-3 text-xs text-muted">
            Cuánto cambia la tendencia (EWMA) de una semana a la siguiente. Solo semanas completas con al menos 2 pesajes; sube o baja
            sin juzgar si es bueno.
          </p>
          <TimeChart
            ariaLabel="Cambio semanal del peso"
            data={changeRows}
            unit="kg"
            digits={2}
            includeZero
            height={200}
            series={[{ key: "change", label: "Cambio semanal", color: "var(--accent)", kind: "bar" }]}
          />
        </Card>
      )}

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

      {steps.series.length > 0 && (
        <Card className="mt-6">
          <CardTitle>Pasos por día de la semana</CardTitle>
          <p className="mb-4 text-xs text-muted">¿Qué días te mueves menos? Con los datos del rango elegido arriba.</p>
          <WeekdaySteps days={weekdays} goal={goals.steps} />
        </Card>
      )}
    </>
  );
}
