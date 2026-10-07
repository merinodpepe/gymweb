import Link from "next/link";
import { notFound } from "next/navigation";
import { DbMissing, hasDatabase } from "@/components/db-missing";
import { SetRow } from "@/components/exercise-card";
import { TimeChart } from "@/components/time-chart";
import { TrendBadge } from "@/components/trend-badge";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { fmt, fmtDate, fmtKg, fmtSigned } from "@/lib/format";
import { mergeSeries } from "@/lib/series";
import { getExerciseProgress } from "@/services/progressService";

export default async function ExercisePage({ params }: PageProps<"/entrenos/[exercise]">) {
  const name = decodeURIComponent((await params).exercise);
  if (!hasDatabase()) return <DbMissing />;

  const p = await getExerciseProgress(name);
  if (!p.sessions.length) notFound();
  const { trend, prs } = p;
  const jumps = new Set(trend.realJumps);
  const rows = mergeSeries({ e1rm: trend.points, ewma: trend.ewma });

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/entrenos" className="text-muted hover:text-strong">← Entrenos</Link>
      </p>
      <PageHeader title={name} subtitle={`${p.sessions.length} sesiones`} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>e1RM por sesión</CardTitle>
          <p className="mb-3 text-xs text-muted">
            Mejor serie de trabajo de cada sesión (1–10 reps, media Epley/Brzycki) y su EWMA (α 0,3 por semana).
          </p>
          {trend.points.length ? (
            <TimeChart
              ariaLabel={`Evolución del e1RM en ${name}`}
              data={rows}
              unit="kg"
              series={[
                { key: "e1rm", label: "e1RM sesión", color: "var(--chart-raw)", kind: "dots" },
                ...(trend.ewma.length ? [{ key: "ewma", label: "Tendencia (EWMA)", color: "var(--accent)", kind: "line" as const }] : []),
              ]}
            />
          ) : (
            <EmptyState>No hay series elegibles (sin calentamiento y ≤10 reps) para calcular e1RM.</EmptyState>
          )}
        </Card>

        <Card>
          <CardTitle>Tendencia</CardTitle>
          {trend.theilSen ? (
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Theil-Sen (12 semanas)</dt>
                <dd className="font-display text-2xl text-strong num">{fmtSigned(trend.theilSen.slope, 2)} kg/sem</dd>
                <dd className="text-xs text-muted num">
                  IC 95 % bootstrap: {fmtSigned(trend.theilSen.ci95[0], 2)} a {fmtSigned(trend.theilSen.ci95[1], 2)}
                </dd>
                <dd className="mt-1">
                  <TrendBadge label={trend.label} texts={{ up: "Mejora", down: "Empeora", flat: "Sin cambio claro" }} />
                </dd>
              </div>
              {trend.ols && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">OLS (contraste)</dt>
                  <dd className="num">
                    {fmtSigned(trend.ols.slope, 2)} kg/sem · IC {fmtSigned(trend.ols.ci95[0], 2)} a {fmtSigned(trend.ols.ci95[1], 2)}
                  </dd>
                </div>
              )}
              {trend.typicalError !== null && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Error típico</dt>
                  <dd className="num">
                    {fmt(trend.typicalError, 1)} kg · salto real &gt; {fmt(trend.typicalError * 1.5, 1)} kg
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">
              {trend.points.length < 3
                ? "Con menos de 3 sesiones solo se muestran los puntos."
                : "Hacen falta al menos 4 sesiones en las últimas 12 semanas para estimar la pendiente."}
            </p>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardTitle>Récords</CardTitle>
          <p className="mb-3 text-xs text-muted">N RM = mayor peso movido en una serie de trabajo de al menos N reps.</p>
          <table className="w-full text-sm">
            <tbody>
              {prs.current.map((r) => (
                <tr key={r.kind} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="py-2 text-left font-medium text-muted">{r.kind === "e1rm" ? "e1RM" : r.kind}</th>
                  <td className="py-2 text-right font-medium text-strong num">{r.kind === "e1rm" ? fmt(r.value, 1) : fmtKg(r.value)} kg</td>
                  <td className="py-2 pl-3 text-right text-xs text-muted">{fmtDate(r.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle>Sesiones</CardTitle>
          <ol className="mt-3 divide-y divide-border">
            {[...p.sessions].reverse().map((s) => {
              const isPr = prs.events.some((e) => e.date === s.date.slice(0, 10) && e.kind === "e1rm");
              return (
                <li key={s.date} className="py-3">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-strong">{fmtDate(s.date, { time: true })}</span>
                    {s.e1rm !== null && <span className="text-muted num">e1RM {fmt(s.e1rm, 1)} kg</span>}
                    {isPr && <span className="rounded bg-accent px-1.5 text-xs font-semibold text-accent-ink">PR</span>}
                    {jumps.has(s.date.slice(0, 10)) && <span className="text-xs text-muted">salto real</span>}
                  </p>
                  <ol className="mt-1">
                    {s.sets.map((set, i) => (
                      <SetRow key={i} set={set} index={i} />
                    ))}
                  </ol>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>
    </>
  );
}
