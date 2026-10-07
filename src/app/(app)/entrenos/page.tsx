import Link from "next/link";
import { connection } from "next/server";
import { DbMissing, hasDatabase } from "@/components/db-missing";
import { ExerciseCard } from "@/components/exercise-card";
import { DeleteButton } from "@/components/forms/delete-button";
import { TrendBadge } from "@/components/trend-badge";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { fmt, fmtDate, fmtShortDate, fmtSigned } from "@/lib/format";
import { workoutRepo } from "@/repositories/workoutRepo";
import { getExerciseOverview } from "@/services/progressService";

export const metadata = { title: "Entrenos" };

export default async function WorkoutsPage() {
  await connection();
  if (!hasDatabase())
    return (
      <>
        <PageHeader title="Entrenos" />
        <DbMissing />
      </>
    );

  const [overview, recent] = await Promise.all([getExerciseOverview(), workoutRepo.list({}, 20)]);
  const weeks = overview.weekly.slice(-8);
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

      <Card>
        <CardTitle>Ejercicios</CardTitle>
        <p className="mb-3 text-xs text-muted">
          Pendiente en kg de e1RM por semana (últimas 12 semanas, ≥4 sesiones). «Mejora/empeora» solo si el IC 95 % excluye el 0.
        </p>
        {overview.exercises.length ? (
          <div className="-mx-4 relative overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium sm:px-2">Ejercicio</th>
                  <th className="px-2 py-2 font-medium">Sesiones</th>
                  <th className="px-2 py-2 font-medium">Último e1RM</th>
                  <th className="px-2 py-2 font-medium">kg/sem</th>
                  <th className="px-2 py-2 font-medium">Tendencia</th>
                </tr>
              </thead>
              <tbody>
                {overview.exercises.map((e) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>
            Aún no hay entrenos. <Link href="/importar" className="underline">Importa uno desde Lyfta</Link>.
          </EmptyState>
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
