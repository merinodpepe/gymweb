import Link from "next/link";
import { connection } from "next/server";
import { DbMissing, hasDatabase } from "@/components/db-missing";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { formatPace } from "@/domain/stats/pace";
import { strengthWord } from "@/domain/stats/correlation";
import { fmt, fmtDate, fmtSigned } from "@/lib/format";
import { getMonthlyReport } from "@/services/insightsService";

export const metadata = { title: "Informe mensual" };

const monthLabel = (m: string) =>
  new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T12:00:00Z`));

function shiftMonth(m: string, delta: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const PR_KIND = (k: string) => (k === "e1rm" ? "e1RM" : k);

export default async function ReportPage({ searchParams }: PageProps<"/informe">) {
  await connection();
  const mes = (await searchParams).mes;
  if (!hasDatabase())
    return (
      <>
        <PageHeader title="Informe mensual" />
        <DbMissing />
      </>
    );

  const { today, report: r } = await getMonthlyReport(typeof mes === "string" ? mes : undefined);
  const current = today.slice(0, 7);
  const partial = r.to < `${r.month}-28` || r.month === current;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/analisis" className="text-muted hover:text-strong">← Análisis</Link>
      </p>
      <PageHeader title={`Informe de ${monthLabel(r.month)}`} subtitle={`Del ${fmtDate(r.from)} al ${fmtDate(r.to)}${partial && r.month === current ? " (mes en curso)" : ""}.`}>
        <nav aria-label="Mes del informe" className="flex gap-2 text-sm">
          <Link href={`/informe?mes=${shiftMonth(r.month, -1)}`} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-muted hover:text-strong">
            ← Anterior
          </Link>
          {r.month < current && (
            <Link href={`/informe?mes=${shiftMonth(r.month, 1)}`} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-muted hover:text-strong">
              Siguiente →
            </Link>
          )}
        </nav>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Peso"
          value={r.weight ? fmtSigned(r.weight.change, 2) : "—"}
          unit="kg"
          detail={r.weight ? `${fmt(r.weight.start, 1)} → ${fmt(r.weight.end, 1)} kg (tendencia EWMA)` : "Sin pesajes suficientes"}
        />
        <KpiCard
          label="Pasos"
          value={r.steps ? fmt(r.steps.mean, 0) : "—"}
          unit="/día"
          detail={r.steps ? `Media de ${r.steps.days} días con dato` : "Sin pasos registrados"}
        />
        <KpiCard
          label="Carrera"
          value={fmt(r.runs.km, 1)}
          unit="km"
          detail={r.runs.count ? `${r.runs.count} carreras · ${formatPace(r.runs.pace_s_per_km)}` : "Sin carreras"}
        />
        <KpiCard
          label="Entrenos"
          value={String(r.workouts.count)}
          detail={`${fmt(r.workouts.tonnage_kg, 0)} kg de volumen total`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Récords del mes</CardTitle>
          <p className="mb-3 text-xs text-muted">Marcas superadas (e1RM y mejor peso para 1, 3, 5, 8 y 10 reps). La primera marca de un ejercicio no cuenta como récord.</p>
          {r.prs.length ? (
            <ul className="divide-y divide-border/60 text-sm">
              {r.prs.map((p) => (
                <li key={`${p.exercise}-${p.kind}-${p.date}`} className="flex items-baseline justify-between gap-3 py-2">
                  <span>
                    <Link href={`/entrenos/${encodeURIComponent(p.exercise)}`} className="font-medium text-strong hover:text-accent hover:underline">{p.exercise}</Link>
                    <span className="ml-2 text-xs text-muted">{PR_KIND(p.kind)}</span>
                  </span>
                  <span className="shrink-0 num">
                    <span className="text-strong">{fmt(p.value, 1)} kg</span>
                    <span className="ml-2 text-xs text-muted">{fmtDate(p.date, { year: false })}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Ningún récord nuevo este mes.</EmptyState>
          )}
        </Card>

        <Card>
          <CardTitle>Ejercicios estancados</CardTitle>
          <p className="mb-3 text-xs text-muted">Sin superar su mejor e1RM (+1 %) en 4 o más sesiones y 3 semanas, y sin tendencia al alza.</p>
          {r.stalled.length ? (
            <ul className="divide-y divide-border/60 text-sm">
              {r.stalled.map((e) => (
                <li key={e} className="py-2">
                  <Link href={`/entrenos/${encodeURIComponent(e)}`} className="font-medium text-strong hover:text-accent hover:underline">{e}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Ninguno.</EmptyState>
          )}
        </Card>

        <Card>
          <CardTitle>Músculos descuidados</CardTitle>
          <p className="mb-3 text-xs text-muted">Series directas por semana de este mes frente al mínimo recomendado del Coach.</p>
          {r.neglected.length ? (
            <ul className="divide-y divide-border/60 text-sm">
              {r.neglected.map((g) => (
                <li key={g.group} className="flex justify-between gap-3 py-2">
                  <span className="font-medium text-strong">{g.group}</span>
                  <span className="num text-muted">
                    <span className="text-strong">{fmt(g.sets_per_week, 1)}</span> / mín. {g.min} series/sem
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Todos los músculos llegan al mínimo.</EmptyState>
          )}
        </Card>

        <Card>
          <CardTitle>Relaciones más fuertes</CardTitle>
          <p className="mb-3 text-xs text-muted">De los cruces de Análisis, solo los que tienen al menos 30 pares y sobreviven a la corrección por comparaciones múltiples. Relación observada, no causa.</p>
          {r.relations.length ? (
            <ol className="divide-y divide-border/60 text-sm">
              {r.relations.map((x) => (
                <li key={x.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
                  <span className="font-medium text-strong">{x.title}</span>
                  <span className="num text-muted">
                    ρ = <span className="text-strong">{fmtSigned(x.rho, 2)}</span> ({strengthWord(x.rho)}) · n = {x.n}
                    {x.lag_weeks ? ` · retardo ${x.lag_weeks} sem` : ""}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState>Todavía no hay datos suficientes para afirmar ninguna relación.</EmptyState>
          )}
        </Card>
      </div>
    </>
  );
}
