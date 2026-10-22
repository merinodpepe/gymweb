import Link from "next/link";
import { connection } from "next/server";
import { DbMissing, hasDatabase } from "@/components/db-missing";
import { ConsistencyKpis, WorkoutHeatmap } from "@/components/consistency-card";
import { ExerciseCard } from "@/components/exercise-card";
import { GroupWeeksChart } from "@/components/group-weeks-chart";
import { VolumeCalendar } from "@/components/volume-calendar";
import { DeleteButton } from "@/components/forms/delete-button";
import { TrendBadge } from "@/components/trend-badge";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { rangeFor } from "@/domain/coach/volumeTargets";
import { REP_BUCKETS } from "@/domain/insights/charts";
import type { ExerciseStatus } from "@/domain/stats/plateau";
import { fmt, fmtDate, fmtShortDate, fmtSigned } from "@/lib/format";
import { workoutRepo } from "@/repositories/workoutRepo";
import { getTrainingCharts } from "@/services/insightsService";
import { getExerciseOverview, INACTIVE_AFTER_DAYS } from "@/services/progressService";

export const metadata = { title: "Entrenos" };

const STATUS: Record<ExerciseStatus, { text: string; tone: string }> = {
  mejorando: { text: "Progresando", tone: "text-good" },
  estable: { text: "Estable", tone: "text-neutral" },
  estancado: { text: "Estancado", tone: "text-accent" },
  bajando: { text: "Bajando", tone: "text-bad" },
  pocos_datos: { text: "Pocos datos", tone: "text-muted" },
};
const PR_LABEL = (kind: string) => (kind === "e1rm" ? "e1RM" : kind);

export default async function WorkoutsPage() {
  await connection();
  if (!hasDatabase())
    return (
      <>
        <PageHeader title="Entrenos" />
        <DbMissing />
      </>
    );

  const [overview, recent, charts] = await Promise.all([getExerciseOverview(), workoutRepo.list({}, 20), getTrainingCharts()]);
  const weeks = overview.weekly.slice(-8);
  const active = overview.exercises.filter((e) => !e.inactive);
  const inactive = overview.exercises.filter((e) => e.inactive);
  const stalled = active.filter((e) => e.plateau.status === "estancado");
  const groups = [...new Set(weeks.flatMap((w) => Object.keys(w.sets_by_group)))].sort();

  return (
    <>
      <PageHeader title="Entrenos" subtitle="Fuerza: e1RM por sesión, tendencia robusta (Theil-Sen) y volumen semanal.">
        <Link
          href="/importar"
          className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-semibold uppercase tracking-wide text-accent-ink"
        >
          Importar Lyfta
        </Link>
      </PageHeader>

      <ConsistencyKpis c={overview.consistency} />

      <Card className="mt-6">
        <CardTitle>Constancia</CardTitle>
        <p className="mb-3 text-xs text-muted">Días con entreno en las últimas 26 semanas (columnas = semanas, de lunes a domingo).</p>
        <WorkoutHeatmap weeks={overview.consistency.heatmap} />
      </Card>

      <Card className="mt-6">
        <CardTitle>Calendario de entrenos</CardTitle>
        <p className="mb-4 text-xs text-muted">Últimos 3 meses. Cuanto más color, más tonelaje (kg × reps de las series de trabajo) ese día.</p>
        <VolumeCalendar months={charts.calendar} />
      </Card>

      {(overview.recentPrs.length > 0 || stalled.length > 0) && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle>Récords recientes</CardTitle>
            <p className="mb-3 text-xs text-muted">Marcas superadas en los últimos 30 días (e1RM y mejor peso para 1, 3, 5, 8 y 10 reps).</p>
            {overview.recentPrs.length ? (
              <ul className="divide-y divide-border/60 text-sm">
                {overview.recentPrs.slice(0, 8).map((p) => (
                  <li key={`${p.exercise}-${p.kind}-${p.date}`} className="flex items-baseline justify-between gap-3 py-2">
                    <span>
                      <Link href={`/entrenos/${encodeURIComponent(p.exercise)}`} className="font-medium text-strong hover:text-accent hover:underline">
                        {p.exercise}
                      </Link>
                      <span className="ml-2 text-xs text-muted">{PR_LABEL(p.kind)}</span>
                    </span>
                    <span className="shrink-0 num">
                      <span className="text-strong">{fmt(p.value, 1)} kg</span>
                      <span className="ml-2 text-xs text-muted">{fmtShortDate(p.date)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>Ningún récord nuevo en 30 días.</EmptyState>
            )}
          </Card>

          <Card>
            <CardTitle>Estancados</CardTitle>
            <p className="mb-3 text-xs text-muted">
              Sin superar su mejor e1RM (+1 %) en 4 o más sesiones y 3 semanas, y sin tendencia al alza. Prueba a añadir una
              repetición, subir el peso, descargar una semana o cambiar el esquema de repeticiones.
            </p>
            {stalled.length ? (
              <ul className="divide-y divide-border/60 text-sm">
                {stalled.map((e) => (
                  <li key={e.name} className="flex items-baseline justify-between gap-3 py-2">
                    <Link href={`/entrenos/${encodeURIComponent(e.name)}`} className="font-medium text-strong hover:text-accent hover:underline">
                      {e.name}
                    </Link>
                    <span className="shrink-0 text-xs text-muted num">
                      {e.plateau.sessions_since_gain} sesiones · {e.plateau.days_since_gain} días
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>Ningún ejercicio estancado.</EmptyState>
            )}
          </Card>
        </div>
      )}

      <Card className="mt-6">
        <CardTitle>Ejercicios</CardTitle>
        <p className="mb-3 text-xs text-muted">
          Solo ejercicios que has hecho en los últimos {INACTIVE_AFTER_DAYS} días; el resto está en «En desuso», abajo.{" "}
          <strong className="font-medium text-text">e1RM</strong> = repetición máxima estimada: el peso que podrías levantar
          una sola vez, calculado con tu mejor serie de la sesión (media de Epley y Brzycki, hasta 10 repeticiones). Sirve
          para comparar sesiones aunque cambies peso y repeticiones. kg/sem es cuánto sube o baja tu e1RM por semana
          (últimas 12 semanas, ≥4 sesiones); «Mejora/empeora» solo si el IC 95 % excluye el 0. «Progresando» exige un récord
          reciente o tendencia al alza; si no, «Estable».
        </p>
        {active.length ? (
          <div className="-mx-4 relative overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium sm:px-2">Ejercicio</th>
                  <th className="px-2 py-2 font-medium">Sesiones</th>
                  <th className="px-2 py-2 font-medium">Último e1RM</th>
                  <th className="px-2 py-2 font-medium">kg/sem</th>
                  <th className="px-2 py-2 font-medium">Tendencia</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {active.map((e) => (
                  <tr key={e.name} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2 sm:px-2">
                      <Link href={`/entrenos/${encodeURIComponent(e.name)}`} className="font-medium text-strong hover:text-accent hover:underline">
                        {e.name}
                      </Link>
                      {e.muscle_group && <span className="ml-2 text-xs text-muted">{e.muscle_group}</span>}
                    </td>
                    <td className="px-2 py-2 num">{e.sessions}</td>
                    <td className="px-2 py-2 text-strong num">{e.last_e1rm ? `${fmt(e.last_e1rm, 1)} kg` : "—"}</td>
                    <td className="px-2 py-2 num">{fmtSigned(e.slope, 2)}</td>
                    <td className="px-2 py-2">
                      <TrendBadge label={e.label} texts={{ up: "Mejora", down: "Empeora", flat: "Sin cambio claro" }} />
                    </td>
                    <td className={`px-2 py-2 text-sm font-medium ${STATUS[e.plateau.status].tone}`}>{STATUS[e.plateau.status].text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>
            {overview.exercises.length ? (
              "Ningún ejercicio en los últimos 14 días."
            ) : (
              <>
                Aún no hay entrenos. <Link href="/importar" className="underline">Importa uno desde Lyfta</Link>.
              </>
            )}
          </EmptyState>
        )}

        {inactive.length > 0 && (
          <details className="mt-6 border-t border-border pt-4">
            <summary className="min-h-11 cursor-pointer text-sm font-medium text-strong">
              En desuso ({inactive.length}) <span className="font-normal text-muted">· más de {INACTIVE_AFTER_DAYS} días sin hacerlos</span>
            </summary>
            <ul className="mt-2 divide-y divide-border/60 text-sm">
              {inactive.map((e) => (
                <li key={e.name} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
                  <span>
                    <Link href={`/entrenos/${encodeURIComponent(e.name)}`} className="font-medium text-strong hover:text-accent hover:underline">
                      {e.name}
                    </Link>
                    {e.muscle_group && <span className="ml-2 text-xs text-muted">{e.muscle_group}</span>}
                  </span>
                  <span className="text-xs text-muted num">
                    {e.sessions} sesiones · último e1RM {e.last_e1rm ? `${fmt(e.last_e1rm, 1)} kg` : "—"} · última vez{" "}
                    {e.last_date ? fmtDate(e.last_date, { year: true }) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      {weeks.length > 0 && (
        <Card className="mt-6">
          <CardTitle>Series efectivas por grupo y semana</CardTitle>
          <p className="mb-3 text-xs text-muted">
            Series de trabajo (sin calentamientos), semanas ISO lunes–domingo. Asigna grupos musculares en{" "}
            <Link href="/datos" className="underline">Datos → alias</Link>.
            {overview.acwr !== null && (
              <> Ratio carga aguda:crónica {fmt(overview.acwr, 2)} (orientativo, no validado).</>
            )}
          </p>
          <div className="-mx-4 relative overflow-x-auto sm:mx-0">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium sm:px-2">Grupo</th>
                  {weeks.map((w) => (
                    <th key={w.week_start} className="px-2 py-2 text-right font-medium">
                      {fmtShortDate(w.week_start)}
                      {w.partial && <span className="block normal-case text-[10px]">(parcial)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2 sm:px-2">{g}</td>
                    {weeks.map((w) => (
                      <td key={w.week_start} className={`px-2 py-2 text-right num ${w.partial ? "text-muted" : "text-strong"}`}>
                        {w.sets_by_group[g] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="text-xs text-muted">
                  <td className="px-4 py-2 sm:px-2">Tonelaje (kg)</td>
                  {weeks.map((w) => (
                    <td key={w.week_start} className="px-2 py-2 text-right num">
                      {fmt(w.tonnage_kg, 0)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {weeks.length > 0 && groups.length > 0 && (
        <Card className="mt-6">
          <CardTitle>Series por músculo frente al objetivo</CardTitle>
          <p className="mb-4 text-xs text-muted">
            Series de trabajo directas por semana (últimas {weeks.length}). La banda verde es el rango objetivo del Coach; la última semana
            es parcial.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => {
              const r = rangeFor(g);
              return (
                <div key={g}>
                  <p className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-medium text-strong">{g}</span>
                    <span className="text-xs text-muted num">objetivo {r.min}–{r.max}</span>
                  </p>
                  <GroupWeeksChart
                    group={g}
                    min={r.min}
                    max={r.max}
                    data={weeks.map((w) => ({ label: fmtShortDate(w.week_start), sets: w.sets_by_group[g] ?? 0, partial: w.partial }))}
                  />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {(charts.reps.length > 0 || charts.hours.some((h) => h.n > 0)) && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle>Rango de repeticiones por músculo</CardTitle>
            <p className="mb-3 text-xs text-muted">
              Series de trabajo de las últimas 8 semanas por rango de repeticiones. ¿Entrenas siempre en el mismo rango?
            </p>
            {charts.reps.length ? (
              <>
                <ul className="space-y-2">
                  {charts.reps.map((r) => (
                    <li key={r.group} className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-3 text-sm">
                      <span className="text-muted">{r.group}</span>
                      <div
                        className="flex h-3 overflow-hidden rounded-full bg-surface-2"
                        role="img"
                        aria-label={`${r.group}: ${REP_BUCKETS.map((b, i) => `${r.counts[i]} series de ${b} reps`).join(", ")}`}
                      >
                        {r.counts.map((n, i) => (
                          <span
                            key={i}
                            style={{ width: `${(n / r.total) * 100}%`, opacity: 0.35 + i * 0.22 }}
                            className="bg-accent"
                          />
                        ))}
                      </div>
                      <span className="text-right text-xs text-muted num">{r.total}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                  {REP_BUCKETS.map((b, i) => (
                    <span key={b} className="inline-flex items-center gap-1.5">
                      <span className="inline-block size-3 rounded-sm bg-accent" style={{ opacity: 0.35 + i * 0.22 }} />
                      {b} reps
                    </span>
                  ))}
                </p>
              </>
            ) : (
              <EmptyState>Sin series con grupo muscular en las últimas 8 semanas.</EmptyState>
            )}
          </Card>

          <Card>
            <CardTitle>Hora del entreno y volumen</CardTitle>
            <p className="mb-3 text-xs text-muted">Tonelaje medio de los entrenos según la hora local a la que empezaron.</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 font-medium">Hora</th>
                  <th className="py-2 text-right font-medium">Entrenos</th>
                  <th className="py-2 text-right font-medium">Tonelaje medio</th>
                </tr>
              </thead>
              <tbody>
                {charts.hours.map((h) => (
                  <tr key={h.label} className="border-b border-border/60 last:border-0">
                    <td className="py-2">{h.label}</td>
                    <td className="py-2 text-right num">{h.n}</td>
                    <td className="py-2 text-right text-strong num">{h.mean_tonnage === null ? "—" : `${fmt(h.mean_tonnage, 0)} kg`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">Con pocos entrenos por tramo es solo orientativo: cuenta cada uno antes de sacar conclusiones.</p>
          </Card>
        </div>
      )}

      {recent.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-display text-xl text-strong">Últimos entrenos</h2>
          <div className="grid gap-3">
            {recent.map((w) => (
              <details key={w.id} className="group rounded-lg border border-border bg-surface">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2">
                  <div className="flex-1">
                    <p className="font-display text-strong">{w.routine_name}</p>
                    <p className="text-xs text-muted">
                      {fmtDate(w.date, { time: true })} · {w.duration_min} min · {fmt(w.total_volume_kg, 0)} kg ·{" "}
                      {w.exercises.length} ejercicios
                    </p>
                  </div>
                  {w.parse_warnings.length > 0 && <Badge className="border-accent/50 text-accent">{w.parse_warnings.length} avisos</Badge>}
                  <span aria-hidden className="text-muted transition-transform group-open:rotate-90">›</span>
                </summary>
                <div className="border-t border-border p-4">
                  {w.notes && <p className="mb-3 whitespace-pre-line text-sm italic text-muted">{w.notes}</p>}
                  <div className="grid gap-3 md:grid-cols-2">
                    {w.exercises.map((e) => (
                      <ExerciseCard key={e.position} name={e.name} canonical={e.canonical_name} notes={e.notes} sets={e.sets} />
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <DeleteButton url={`/api/workouts/${w.id}`} label="Borrar entreno" confirmText={`¿Borrar «${w.routine_name}» del ${fmtDate(w.date)}?`} />
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
