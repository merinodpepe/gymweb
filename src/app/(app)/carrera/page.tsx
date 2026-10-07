import { DbMissing, hasDatabase } from "@/components/db-missing";
import { DeleteButton } from "@/components/forms/delete-button";
import { RunForm } from "@/components/forms/run-form";
import { normalizeRange, RangeTabs } from "@/components/range-tabs";
import { TimeChart } from "@/components/time-chart";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import type { Surface } from "@/domain/schemas/run";
import { formatDuration, formatPace, paceSecPerKm, paceVsComparable, summarizeRuns } from "@/domain/stats/pace";
import { fmt, fmtDate } from "@/lib/format";
import { mergeSeries } from "@/lib/series";
import { runRepo } from "@/repositories/runRepo";
import { parseRange } from "@/services/range";

export const metadata = { title: "Carrera" };

const SURFACE_LABEL: Record<Surface, string> = { outdoor: "Exterior", treadmill: "Cinta" };

export default async function RunsPage({ searchParams }: PageProps<"/carrera">) {
  const range = normalizeRange((await searchParams).range);
  if (!hasDatabase())
    return (
      <>
        <PageHeader title="Carrera" />
        <DbMissing />
      </>
    );
  const { today, from } = parseRange(range);
  const all = await runRepo.list({ to: today });
  const runs = from ? all.filter((r) => r.date >= from) : all;

  return (
    <>
      <PageHeader title="Carrera" subtitle="Ritmo agregado = tiempo total / distancia total. Cinta y exterior por separado.">
        <RangeTabs current={range} basePath="/carrera" />
      </PageHeader>

      <Card>
        <CardTitle>Nueva carrera</CardTitle>
        <div className="mt-4">
          <RunForm today={today} />
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {(["outdoor", "treadmill"] as const).map((surface) => {
          const list = runs.filter((r) => r.surface === surface);
          const sum = summarizeRuns(list);
          const rows = mergeSeries({ pace: list.map((r) => ({ date: r.date, value: paceSecPerKm(r) })) });
          return (
            <Card key={surface}>
              <CardTitle>{SURFACE_LABEL[surface]}</CardTitle>
              <dl className="mt-3 grid grid-cols-4 gap-2 text-sm">
                {[
                  ["Carreras", String(sum.count)],
                  ["Km", fmt(sum.distance_km, 1)],
                  ["Ritmo", formatPace(sum.pace_s_per_km).replace(" /km", "")],
                  ["Desnivel", `${fmt(sum.elevation_gain_m, 0)} m`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs uppercase tracking-wide text-muted">{k}</dt>
                    <dd className="font-display text-lg text-strong num">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4">
                {list.length ? (
                  <TimeChart
                    ariaLabel={`Ritmo por carrera en ${SURFACE_LABEL[surface].toLowerCase()}`}
                    data={rows}
                    unit="/km"
                    format="pace"
                    height={200}
                    series={[{ key: "pace", label: "Ritmo", color: "var(--accent)", kind: "dots" }]}
                  />
                ) : (
                  <EmptyState>Sin carreras en este rango.</EmptyState>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardTitle>Historial</CardTitle>
        <p className="mb-3 text-xs text-muted">
          «vs. comparables»: diferencia de ritmo frente a rodajes anteriores de la misma superficie y distancia ±20 %
          (negativo = más rápido).
        </p>
        {runs.length ? (
          <div className="-mx-4 relative overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium sm:px-2">Fecha</th>
                  <th className="px-2 py-2 font-medium">Superficie</th>
                  <th className="px-2 py-2 text-right font-medium">Km</th>
                  <th className="px-2 py-2 text-right font-medium">Tiempo</th>
                  <th className="px-2 py-2 text-right font-medium">Ritmo</th>
                  <th className="px-2 py-2 text-right font-medium">Desnivel</th>
                  <th className="px-2 py-2 text-right font-medium">vs. comparables</th>
                  <th className="px-2 py-2"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {[...runs].reverse().map((r) => {
                  const delta = paceVsComparable(r, all);
                  return (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-1 sm:px-2">
                        {fmtDate(r.date)}
                        {r.notes && <span className="block text-xs text-muted">{r.notes}</span>}
                      </td>
                      <td className="px-2 py-1">{SURFACE_LABEL[r.surface]}</td>
                      <td className="px-2 py-1 text-right text-strong num">{fmt(r.distance_km, 2)}</td>
                      <td className="px-2 py-1 text-right num">{formatDuration(r.duration_s)}</td>
                      <td className="px-2 py-1 text-right text-strong num">{formatPace(paceSecPerKm(r))}</td>
                      <td className="px-2 py-1 text-right num">{r.elevation_gain_m} m</td>
                      <td className="px-2 py-1 text-right num">
                        {delta === null ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <span className={Math.abs(delta) < 1 ? "text-neutral" : delta < 0 ? "text-good" : "text-bad"}>
                            {delta < 0 ? "↓ " : delta > 0 ? "↑ " : "→ "}
                            {Math.abs(Math.round(delta))} s/km {delta < 0 ? "más rápido" : delta > 0 ? "más lento" : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right">
                        <DeleteButton url={`/api/runs/${r.id}`} label="Borrar carrera" confirmText={`¿Borrar la carrera del ${fmtDate(r.date)}?`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>Sin carreras en este rango.</EmptyState>
        )}
      </Card>
    </>
  );
}
