import Link from "next/link";
import { connection } from "next/server";
import { AlertsCard } from "@/components/alerts-card";
import { CrossCard } from "@/components/cross-card";
import { DbMissing, hasDatabase } from "@/components/db-missing";
import { TimeChart } from "@/components/time-chart";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import type { Quadrant } from "@/domain/insights/crosses";
import { WEEKDAYS } from "@/domain/insights/charts";
import { MIN_PAIRS } from "@/domain/stats/correlation";
import { formatPace } from "@/domain/stats/pace";
import { fmt, fmtDate, fmtShortDate, fmtSigned } from "@/lib/format";
import { mergeSeries } from "@/lib/series";
import { getAnalysis } from "@/services/insightsService";

export const metadata = { title: "Análisis" };

const QUADRANT: Record<Quadrant, string> = {
  ambos_suben: "Suben el peso y la fuerza",
  peso_sube_fuerza_no: "Sube el peso, no la fuerza",
  fuerza_sube_peso_no: "Sube la fuerza, no el peso",
  ninguno_sube: "No sube ninguno",
};
const COLORS = ["var(--accent)", "var(--chart-secondary)", "var(--good)", "var(--heat-warn)", "var(--heat-high)", "var(--bad)"];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-strong">{title}</h2>
      {hint && <p className="mb-4 mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-4 grid gap-6 lg:grid-cols-2">{children}</div>
    </section>
  );
}

export default async function AnalysisPage() {
  await connection();
  if (!hasDatabase())
    return (
      <>
        <PageHeader title="Análisis" />
        <DbMissing />
      </>
    );

  const a = await getAnalysis();
  const byId = Object.fromEntries(a.crosses.map((c) => [c.id, c]));
  const relRows = mergeSeries(Object.fromEntries(a.relative.map((r, i) => [`e${i}`, r.points])));
  const lastWindows = a.quadrants.slice(-6);
  const counts = Object.fromEntries((Object.keys(QUADRANT) as Quadrant[]).map((q) => [q, a.quadrants.filter((w) => w.quadrant === q).length]));

  return (
    <>
      <PageHeader title="Análisis" subtitle="Cruces entre peso, fuerza y carrera. Relaciones observadas, no causas.">
        <Link
          href="/informe"
          className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface-2 px-4 text-sm font-semibold uppercase tracking-wide text-strong hover:border-accent"
        >
          Informe mensual
        </Link>
      </PageHeader>

      <AlertsCard alerts={a.alerts} />

      <Card className="mt-6">
        <CardTitle>Cómo leer esta página</CardTitle>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>
            Con menos de {MIN_PAIRS} pares de datos solo se muestra el gráfico de dispersión y el número de pares (<span className="num">n</span>), sin
            coeficiente.
          </li>
          <li>Se usa la correlación de Spearman (por rangos) con intervalo de confianza del 95 % por bootstrap, no Pearson.</li>
          <li>Peso y fuerza reaccionan con retraso: se prueban retardos y se muestra el mejor, avisando de que probar varios infla el azar.</li>
          <li>Con varios cruces a la vez solo se destacan los que sobreviven a la corrección de Benjamini-Hochberg (5 %).</li>
          <li>Los días sin dato se excluyen del par, nunca se rellenan con 0.</li>
          <li>Confusores conocidos: la báscula (ya corregida), la hidratación y la sal, y las semanas parciales (no entran).</li>
        </ul>
      </Card>

      <Section title="Peso y el resto">
        <CrossCard c={byId["km-peso"]} />
        <CrossCard c={byId["pasos-peso"]} />

        <Card>
          <CardTitle>{a.legs.title}</CardTitle>
          <p className="text-sm text-muted">{a.legs.question}</p>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-border">
                <th className="py-2 font-medium">Series de piernas en los 2 días previos</th>
                <th className="py-2 text-right font-medium">Pesajes</th>
                <th className="py-2 text-right font-medium">Mediana vs. tendencia</th>
              </tr>
            </thead>
            <tbody>
              {a.legs.levels.map((l) => (
                <tr key={l.level} className="border-b border-border/60 last:border-0">
                  <td className="py-2">{l.level}</td>
                  <td className="py-2 text-right num">{l.n}</td>
                  <td className="py-2 text-right text-strong num">{l.median === null ? "—" : `${fmtSigned(l.median, 2)} kg`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">
            {a.legs.enough
              ? `Con ${a.legs.n} pesajes.`
              : `Con ${a.legs.n} pesajes (hacen falta ${MIN_PAIRS} y al menos dos niveles con 5 o más): de momento solo orientativo.`}{" "}
            {a.legs.caveat}
          </p>
        </Card>

        <Card>
          <CardTitle>Deriva de las básculas</CardTitle>
          <p className="text-sm text-muted">¿Cuánto pesa realmente cada báscula, y se mueve con el tiempo?</p>
          {a.drift.length ? (
            <ul className="mt-3 divide-y divide-border/60 text-sm">
              {a.drift.map((d) => (
                <li key={d.scale} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
                  <span className="font-medium text-strong">{d.scale}</span>
                  <span className="num">
                    ahora {fmtSigned(d.now, 2)} kg · hace 90 días {fmtSigned(d.before, 2)} kg
                    {d.drifting ? <Badge className="ml-2 border-accent/60 text-accent">deriva {fmtSigned(d.change, 2)} kg</Badge> : <span className="ml-2 text-muted">estable</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Hace falta calibrar al menos una báscula ahora y hace 90 días (pesajes en varias básculas en días cercanos).</EmptyState>
          )}
          <p className="mt-2 text-xs text-muted">Se avisa de deriva si el sesgo cambia más que el ruido de la estimación (mínimo 0,3 kg).</p>
        </Card>
      </Section>

      <Section title="Fuerza" hint="Cada punto de frecuencia y volumen es un ejercicio en una ventana de 4 semanas, con la tendencia del e1RM (EWMA).">
        <Card className="lg:col-span-2">
          <CardTitle>Fuerza relativa</CardTitle>
          <p className="mb-3 text-sm text-muted">e1RM dividido por tu peso (EWMA): ¿mejora tu fuerza relativa?</p>
          {a.relative.length ? (
            <>
              <TimeChart
                ariaLabel="Fuerza relativa por ejercicio"
                data={relRows}
                unit="× peso"
                digits={2}
                series={a.relative.map((r, i) => ({ key: `e${i}`, label: r.exercise, color: COLORS[i % COLORS.length], kind: "line" as const }))}
              />
              <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {a.relative.map((r) => (
                  <li key={r.exercise} className="flex justify-between gap-3">
                    <span className="text-strong">{r.exercise}</span>
                    <span className="num text-muted">
                      {fmt(r.first, 2)} → {fmt(r.last, 2)} ({fmtSigned(r.change_pct, 1)} %)
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState>Hacen falta pesajes y al menos 4 sesiones de un ejercicio.</EmptyState>
          )}
        </Card>

        <CrossCard c={byId["frecuencia-progreso"]} />
        <CrossCard c={byId["volumen-progreso"]}>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-border">
                <th className="py-1 font-medium">Series/sem</th>
                <th className="py-1 text-right font-medium">Ventanas</th>
                <th className="py-1 text-right font-medium">Mediana del e1RM</th>
              </tr>
            </thead>
            <tbody>
              {a.volumeBins.map((b) => (
                <tr key={b.label} className="border-b border-border/60 last:border-0">
                  <td className="py-1 num">{b.label}</td>
                  <td className="py-1 text-right num">{b.n}</td>
                  <td className="py-1 text-right text-strong num">{b.median_gain === null ? "—" : `${fmtSigned(b.median_gain, 2)} %/sem`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrossCard>

        <CrossCard c={byId["descanso-sesion"]} />

        <Card>
          <CardTitle>{a.position.title}</CardTitle>
          <p className="text-sm text-muted">{a.position.question}</p>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-border">
                <th className="py-1 font-medium">Posición</th>
                <th className="py-1 text-right font-medium">Ejercicios</th>
                <th className="py-1 text-right font-medium">e1RM vs. su media</th>
              </tr>
            </thead>
            <tbody>
              {a.position.buckets.map((b) => (
                <tr key={b.label} className="border-b border-border/60 last:border-0">
                  <td className="py-1">{b.label}</td>
                  <td className="py-1 text-right num">{b.n}</td>
                  <td className="py-1 text-right text-strong num">{b.mean_pct === null ? "—" : `${fmt(b.mean_pct, 1)} %`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">
            {a.position.enough ? `Con ${a.position.n} ejercicios.` : `Con ${a.position.n} ejercicios (hacen falta ${MIN_PAIRS}): de momento solo orientativo.`}{" "}
            {a.position.caveat}
          </p>
        </Card>

        <Card>
          <CardTitle>¿El peso sube y mi fuerza también?</CardTitle>
          <p className="text-sm text-muted">Ventanas de 8 semanas: pendiente del peso frente a la del e1RM de tus ejercicios (mediana).</p>
          {a.quadrants.length ? (
            <>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {(Object.keys(QUADRANT) as Quadrant[]).map((q) => (
                  <div key={q} className="rounded-md border border-border p-2">
                    <dt className="text-xs text-muted">{QUADRANT[q]}</dt>
                    <dd className="font-display text-lg text-strong num">{counts[q]} <span className="text-xs text-muted">ventanas</span></dd>
                  </div>
                ))}
              </dl>
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted">
                  <tr className="border-b border-border">
                    <th className="py-1 font-medium">Hasta</th>
                    <th className="py-1 text-right font-medium">Peso kg/sem</th>
                    <th className="py-1 text-right font-medium">Fuerza %/sem</th>
                    <th className="py-1 pl-3 font-medium">Cuadrante</th>
                  </tr>
                </thead>
                <tbody>
                  {lastWindows.map((w) => (
                    <tr key={w.end} className="border-b border-border/60 last:border-0">
                      <td className="py-1">{fmtShortDate(w.end)}</td>
                      <td className="py-1 text-right num">{fmtSigned(w.weight_slope, 2)}</td>
                      <td className="py-1 text-right num">{fmtSigned(w.strength_slope, 2)}</td>
                      <td className="py-1 pl-3 text-xs">{QUADRANT[w.quadrant]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <EmptyState>Hacen falta 8 semanas con pesajes y al menos 2 ejercicios con 3 sesiones.</EmptyState>
          )}
          <p className="mt-2 text-xs text-muted">Umbrales: ±0,1 kg/sem de peso y ±0,1 %/sem de fuerza.</p>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle>¿Qué entrenos se me caen?</CardTitle>
          <p className="mb-3 text-sm text-muted">Rutinas de las últimas semanas: cuántas semanas las haces y qué día de la semana. «Se cae» = menos de la mitad de las semanas (con 4 o más semanas de historial).</p>
          {a.adherence.length ? (
            <div className="-mx-4 overflow-x-auto sm:mx-0">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 font-medium sm:px-2">Rutina</th>
                    <th className="px-2 py-2 text-right font-medium">Semanas</th>
                    {WEEKDAYS.map((d) => (
                      <th key={d} className="px-1 py-2 text-center font-medium" title={d}>{d[0]}</th>
                    ))}
                    <th className="px-2 py-2 font-medium">Última vez</th>
                  </tr>
                </thead>
                <tbody>
                  {a.adherence.map((r) => (
                    <tr key={r.routine} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2 sm:px-2">
                        <span className="font-medium text-strong">{r.routine}</span>
                        {r.often_missed && <Badge className="ml-2 border-accent/60 text-accent">se cae</Badge>}
                      </td>
                      <td className="px-2 py-2 text-right num">{r.weeks_done}/{r.weeks}</td>
                      {r.weekdays.map((n, i) => (
                        <td key={i} className={`px-1 py-2 text-center num ${i === r.usual_weekday ? "font-semibold text-accent" : n ? "text-strong" : "text-muted"}`}>{n || "·"}</td>
                      ))}
                      <td className="px-2 py-2 text-xs text-muted">{fmtDate(r.last_date, { year: false })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>Aún no hay entrenos recientes.</EmptyState>
          )}
        </Card>
      </Section>

      <Section title="Carrera">
        <CrossCard c={byId["carrera-piernas"]} />
        {a.pace.map((p) => (
          <CrossCard key={p.cross.id} c={p.cross}>
            {p.sec_per_kg && (
              <p className="mt-2 text-sm text-text num">
                Theil-Sen: <span className="font-medium text-strong">{fmtSigned(p.sec_per_kg.slope, 1)} s/km</span> por cada kg (IC 95 %: {fmtSigned(p.sec_per_kg.ci95[0], 1)} a {fmtSigned(p.sec_per_kg.ci95[1], 1)}).
              </p>
            )}
          </CrossCard>
        ))}
        <Card>
          <CardTitle>Cinta frente a exterior</CardTitle>
          <p className="text-sm text-muted">Diferencia de ritmo a igual esfuerzo percibido (1–10).</p>
          {a.effort.some((b) => b.outdoor.n + b.treadmill.n > 0) ? (
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-border">
                  <th className="py-1 font-medium">Esfuerzo</th>
                  <th className="py-1 text-right font-medium">Exterior</th>
                  <th className="py-1 text-right font-medium">Cinta</th>
                  <th className="py-1 text-right font-medium">Cinta − exterior</th>
                </tr>
              </thead>
              <tbody>
                {a.effort.map((b) => (
                  <tr key={b.band} className="border-b border-border/60 last:border-0">
                    <td className="py-1">{b.band}</td>
                    <td className="py-1 text-right num">{b.outdoor.n ? `${formatPace(b.outdoor.pace)} (${b.outdoor.n})` : "—"}</td>
                    <td className="py-1 text-right num">{b.treadmill.n ? `${formatPace(b.treadmill.pace)} (${b.treadmill.n})` : "—"}</td>
                    <td className="py-1 text-right text-strong num">{b.diff_s === null ? "—" : `${fmtSigned(b.diff_s, 0)} s/km`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState>Aún no hay carreras con esfuerzo percibido: rellena el campo «Esfuerzo» al añadir una carrera.</EmptyState>
          )}
          <p className="mt-2 text-xs text-muted">Entre paréntesis, nº de carreras. La diferencia solo se calcula con al menos 2 en cada superficie y banda.</p>
        </Card>
      </Section>
    </>
  );
}
