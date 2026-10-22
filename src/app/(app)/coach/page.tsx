import Link from "next/link";
import { connection } from "next/server";
import { BodyHeatmap } from "@/components/body-heatmap";
import { DbMissing, hasDatabase } from "@/components/db-missing";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import type { VolumeStatus } from "@/domain/coach/volumeTargets";
import type { GroupReport } from "@/domain/coach/weeklyCoach";
import { cn } from "@/lib/cn";
import { fmt as fmtNum, fmtShortDate } from "@/lib/format";
import { getCoachReport } from "@/services/coachService";

export const metadata = { title: "Coach" };

/** Whole numbers without decimals ("10"), otherwise one decimal ("7,5"). */
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : fmtNum(n, 1));

const STATUS: Record<VolumeStatus, { label: string; text: string; bar: string }> = {
  muy_bajo: { label: "Muy bajo", text: "text-bad", bar: "bg-bad" },
  bajo: { label: "Bajo", text: "text-bad", bar: "bg-bad/60" },
  objetivo: { label: "En objetivo", text: "text-good", bar: "bg-good" },
  alto: { label: "Alto", text: "text-muted", bar: "bg-accent" },
};

/** Bar scaled to 1.5× the top of the range, with the target zone shaded. */
function RangeBar({ g, value, bar, label }: { g: GroupReport; value: number; bar: string; label: string }) {
  const scale = g.range.max * 1.5;
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  return (
    <div className="relative h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={label}>
      <div
        className="absolute inset-y-0 bg-good/20"
        style={{ left: pct(g.range.min), width: `calc(${pct(g.range.max)} - ${pct(g.range.min)})` }}
      />
      <div className={cn("absolute inset-y-0 left-0 rounded-full", bar)} style={{ width: pct(value) }} />
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <li className="border-b border-border/60 py-4 first:pt-0 last:border-0 last:pb-0">{children}</li>;
}

export default async function CoachPage({ searchParams }: PageProps<"/coach">) {
  await connection();
  const mapa = (await searchParams).mapa === "media" ? "media" : "semana";
  if (!hasDatabase())
    return (
      <>
        <PageHeader title="Coach" />
        <DbMissing />
      </>
    );

  const report = await getCoachReport();
  const previous = report.week_starts.slice(0, -1);
  const currentStart = report.week_starts.at(-1)!;

  // This week: what is still missing, most missing first.
  const thisWeek = [...report.groups].sort(
    (a, b) => b.current_deficit - a.current_deficit || b.current.total - a.current.total || a.group.localeCompare(b.group),
  );
  const missing = thisWeek.filter((g) => g.current_deficit > 0);
  // Last weeks: least trained first (report order).
  const weakest = report.groups.filter((g) => g.status === "muy_bajo" || g.status === "bajo").slice(0, 3);

  return (
    <>
      <PageHeader
        title="Coach"
        subtitle="Series efectivas por músculo: cómo vas esta semana y cómo fueron las 3 anteriores."
      />

      {!report.has_data ? (
        <EmptyState>Aún no hay entrenos en las últimas semanas. Sincroniza o importa tus entrenos.</EmptyState>
      ) : (
        <div className="grid gap-6">
          <Card>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Mapa muscular</CardTitle>
              <nav aria-label="Periodo del mapa" className="flex gap-1 text-sm">
                {(["semana", "media"] as const).map((m) => (
                  <Link
                    key={m}
                    href={m === "semana" ? "/coach" : "/coach?mapa=media"}
                    aria-current={mapa === m ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-md px-3 text-muted hover:text-strong",
                      mapa === m && "bg-surface-2 text-strong",
                    )}
                  >
                    {m === "semana" ? "Esta semana" : "Media 3 semanas"}
                  </Link>
                ))}
              </nav>
            </div>
            <p className="mb-4 text-xs text-muted">
              Cuanto más color, más series efectivas frente al máximo semanal recomendado de cada músculo.
            </p>
            <BodyHeatmap groups={report.groups} value={(g) => (mapa === "media" ? g.average : g.current.total)} />
          </Card>

          <Card>
            <CardTitle>Esta semana</CardTitle>
            <p className="mb-4 text-xs text-muted">
              Desde el lunes {fmtShortDate(currentStart)}.{" "}
              {missing.length
                ? `Te faltan series en ${missing.length} ${missing.length === 1 ? "músculo" : "músculos"} para llegar al mínimo.`
                : "Has llegado al mínimo en todos los músculos."}
            </p>
            <ul>
              {thisWeek.map((g) => {
                const done = g.current_deficit === 0;
                return (
                  <Row key={g.group}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="font-medium text-strong">{g.group}</span>
                      <span className="num shrink-0 text-sm">
                        <span className="text-strong">{fmt(g.current.total)}</span>
                        <span className="text-muted"> / {g.range.min}–{g.range.max}</span>
                      </span>
                    </div>
                    <RangeBar
                      g={g}
                      value={g.current.total}
                      bar={done ? "bg-good" : "bg-accent"}
                      label={`${g.group}: ${fmt(g.current.total)} series esta semana; objetivo ${g.range.min} a ${g.range.max}`}
                    />
                    <p className={cn("mt-1 text-xs", done ? "text-good" : "text-muted")}>
                      {done
                        ? g.current.total > g.range.max
                          ? "Por encima del máximo de la semana."
                          : "Mínimo alcanzado."
                        : `Te faltan ${fmt(g.current_deficit)} series para el mínimo.`}
                      {g.current.direct !== g.current.total && ` (${g.current.direct} directas)`}
                      {report.tracks_failure && g.current.failure > 0 && ` · ${g.current.failure} al fallo`}
                    </p>
                  </Row>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardTitle>Últimas 3 semanas</CardTitle>
            <p className="mb-4 text-xs text-muted">
              Media de las 3 semanas completas ({fmtShortDate(previous[0])} – {fmtShortDate(currentStart)}), del músculo
              menos entrenado al más. Los otros músculos que participan cuentan la mitad (el press suma ½ a Tríceps).{" "}
              {report.tracks_failure
                ? "«Al fallo» cuenta las series que marcas con el tipo «fallo» en Lyfta, desde que empezaste a marcarlas."
                : "Aún no hay series marcadas como «fallo» en Lyfta, así que todas cuentan como efectivas."}
            </p>

            {weakest.length > 0 && (
              <p className="mb-4 rounded-md bg-surface-2 px-3 py-2 text-sm text-muted">
                Más flojos:{" "}
                {weakest.map((g, i) => (
                  <span key={g.group}>
                    {i > 0 && ", "}
                    <span className="font-medium text-strong">{g.group}</span> ({fmt(g.average)}/sem)
                  </span>
                ))}
                .
              </p>
            )}

            <ul>
              {report.groups.map((g) => (
                <Row key={g.group}>
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium text-strong">{g.group}</span>
                    <span className="num text-sm">
                      <span className={cn("font-medium", STATUS[g.status].text)}>{STATUS[g.status].label}</span>
                      <span className="text-muted"> · media </span>
                      <span className="text-strong">{fmt(g.average)}</span>
                      <span className="text-muted"> / {g.range.min}–{g.range.max}</span>
                    </span>
                  </div>
                  <RangeBar
                    g={g}
                    value={g.average}
                    bar={STATUS[g.status].bar}
                    label={`${g.group}: ${fmt(g.average)} series por semana de media; objetivo ${g.range.min} a ${g.range.max}`}
                  />
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                    {g.weeks
                      .filter((w) => !w.partial)
                      .map((w) => (
                        <div key={w.week_start} className="rounded-md bg-surface-2 px-1 py-1.5">
                          <dt className="text-muted">Sem. {fmtShortDate(w.week_start)}</dt>
                          <dd className="num text-sm font-medium text-strong">{fmt(w.total)}</dd>
                        </div>
                      ))}
                  </dl>
                  {report.tracks_failure && g.failure_share !== null && (
                    <p className="mt-2 text-xs text-muted num">
                      Al fallo: <span className="text-strong">{fmt(g.failure_average)}</span> series/sem ·{" "}
                      <span className="text-strong">{Math.round(g.failure_share * 100)} %</span> de las directas
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted">
                    {g.advice}{g.frequency > 0 && <span className="num"> ({fmt(g.frequency)} días/sem)</span>}
                  </p>
                </Row>
              ))}
            </ul>
          </Card>

          {report.unassigned_sets > 0 && (
            <p className="text-sm text-muted">
              {report.unassigned_sets} series no cuentan porque su ejercicio no tiene grupo muscular. Asígnalo en{" "}
              <Link href="/datos" className="text-accent underline">
                Datos → Alias
              </Link>
              .
            </p>
          )}
        </div>
      )}
    </>
  );
}
