import Link from "next/link";
import { connection } from "next/server";
import { DbMissing, hasDatabase } from "@/components/db-missing";
import { KpiCard } from "@/components/kpi-card";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import type { GroupReport } from "@/domain/coach/weeklyCoach";
import type { VolumeStatus } from "@/domain/coach/volumeTargets";
import { cn } from "@/lib/cn";
import { fmt, fmtShortDate } from "@/lib/format";
import { getCoachReport } from "@/services/coachService";

export const metadata = { title: "Coach" };

const STATUS: Record<VolumeStatus, { label: string; text: string; bar: string }> = {
  muy_bajo: { label: "Muy bajo", text: "text-bad", bar: "bg-bad" },
  bajo: { label: "Bajo", text: "text-bad", bar: "bg-bad/60" },
  objetivo: { label: "En objetivo", text: "text-good", bar: "bg-good" },
  alto: { label: "Alto", text: "text-muted", bar: "bg-accent" },
};

/** Bar scaled to 1.5× the top of the range, with the target zone shaded. */
function RangeBar({ g }: { g: GroupReport }) {
  const scale = g.range.max * 1.5;
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  return (
    <div
      className="relative h-3 overflow-hidden rounded-full bg-surface-2"
      role="img"
      aria-label={`${g.group}: ${fmt(g.average)} series por semana de media; objetivo ${g.range.min} a ${g.range.max}`}
    >
      <div
        className="absolute inset-y-0 bg-good/20"
        style={{ left: pct(g.range.min), width: `calc(${pct(g.range.max)} - ${pct(g.range.min)})` }}
      />
      <div className={cn("absolute inset-y-0 left-0 rounded-full", STATUS[g.status].bar)} style={{ width: pct(g.average) }} />
    </div>
  );
}

export default async function CoachPage() {
  await connection();
  if (!hasDatabase())
    return (
      <>
        <PageHeader title="Coach" />
        <DbMissing />
      </>
    );

  const report = await getCoachReport();
  const weakest = report.groups.filter((g) => g.status === "muy_bajo" || g.status === "bajo").slice(0, 3);
  const [first, ...rest] = report.week_starts;
  const range = `${fmtShortDate(first)} – ${fmtShortDate(rest.at(-1) ?? first)}`;

  return (
    <>
      <PageHeader
        title="Coach"
        subtitle={`Series efectivas por músculo y semana (${range}): la semana actual y las 4 anteriores.`}
      />

      {!report.has_data ? (
        <EmptyState>Aún no hay entrenos en las últimas 5 semanas. Sincroniza o importa tus entrenos.</EmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {weakest.length ? (
              weakest.map((g) => (
                <KpiCard
                  key={g.group}
                  label={`Más flojo: ${g.group}`}
                  value={fmt(g.average)}
                  unit="series/sem"
                  detail={`Te faltan ~${Math.ceil(g.deficit)} para ${g.range.min}`}
                />
              ))
            ) : (
              <KpiCard label="Estado" value="Todo en zona" detail="Ningún músculo por debajo de su mínimo." />
            )}
          </div>

          <Card className="mt-6">
            <CardTitle>Series efectivas por músculo</CardTitle>
            <p className="mb-4 text-xs text-muted">
              Series de trabajo (sin calentamiento). Las series de otros músculos que participan cuentan la mitad (p. ej. el
              press suma ½ a Tríceps). La valoración usa la media de las 4 semanas completas; la zona verde es el objetivo
              semanal. Sin RIR no se distingue una serie cerca del fallo de una fácil.
            </p>
            <ul className="grid gap-5">
              {report.groups.map((g) => (
                <li key={g.group}>
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-strong">{g.group}</span>
                    <span className="text-sm">
                      <span className={cn("font-medium", STATUS[g.status].text)}>{STATUS[g.status].label}</span>
                      <span className="text-muted">
                        {" "}· media <span className="num text-strong">{fmt(g.average)}</span> · esta semana{" "}
                        <span className="num text-strong">{fmt(g.current.total)}</span> · objetivo {g.range.min}–{g.range.max}
                      </span>
                    </span>
                  </div>
                  <RangeBar g={g} />
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    {g.weeks.map((w) => (
                      <span key={w.week_start} title={`Semana del ${fmtShortDate(w.week_start)}`} className="num">
                        {fmtShortDate(w.week_start)}: <span className="text-strong">{fmt(w.total)}</span>
                        {w.direct !== w.total && <span> ({w.direct} directas)</span>}
                        {w.partial && <span> en curso</span>}
                      </span>
                    ))}
                    <Badge>{fmt(g.frequency)} días/sem</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">{g.advice}</p>
                </li>
              ))}
            </ul>
          </Card>

          {report.unassigned_sets > 0 && (
            <p className="mt-4 text-sm text-muted">
              {report.unassigned_sets} series no cuentan porque su ejercicio no tiene grupo muscular. Asígnalo en{" "}
              <Link href="/datos" className="text-accent underline">
                Datos → Alias
              </Link>
              .
            </p>
          )}
        </>
      )}
    </>
  );
}
