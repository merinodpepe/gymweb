import { DbMissing, hasDatabase } from "@/components/db-missing";
import { DeleteButton } from "@/components/forms/delete-button";
import { NutritionForm } from "@/components/forms/nutrition-form";
import { normalizeRange, RangeTabs } from "@/components/range-tabs";
import { TimeChart } from "@/components/time-chart";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { fmt, fmtDate, fmtShortDate } from "@/lib/format";
import { mergeSeries } from "@/lib/series";
import { getNutrition } from "@/services/nutritionService";

export const metadata = { title: "Nutrición" };

export default async function NutritionPage({ searchParams }: PageProps<"/nutricion">) {
  const range = normalizeRange((await searchParams).range);
  if (!hasDatabase())
    return (
      <>
        <PageHeader title="Nutrición" />
        <DbMissing />
      </>
    );
  const { today, rows, weeks } = await getNutrition(range);
  const kcalRows = mergeSeries({ kcal: rows.map((r) => ({ date: r.date, value: r.kcal })) });
  const protRows = mergeSeries({ protein: rows.map((r) => ({ date: r.date, value: r.protein_g })) });

  return (
    <>
      <PageHeader title="Nutrición" subtitle="Totales diarios. Vista independiente: no se cruza con el peso.">
        <RangeTabs current={range} basePath="/nutricion" />
      </PageHeader>

      <Card>
        <CardTitle>Registrar día</CardTitle>
        <p className="mb-4 text-xs text-muted">Si el día ya existe, se reemplaza.</p>
        <NutritionForm today={today} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Kcal diarias</CardTitle>
          <div className="mt-3">
            {rows.length ? (
              <TimeChart ariaLabel="Kcal por día" data={kcalRows} unit="kcal" digits={0} zeroBased height={220}
                series={[{ key: "kcal", label: "Kcal", color: "var(--accent)", kind: "bar" }]} />
            ) : (
              <EmptyState>Sin datos en este rango.</EmptyState>
            )}
          </div>
        </Card>
        <Card>
          <CardTitle>Proteína diaria</CardTitle>
          <div className="mt-3">
            {rows.length ? (
              <TimeChart ariaLabel="Proteína por día" data={protRows} unit="g" digits={0} zeroBased height={220}
                series={[{ key: "protein", label: "Proteína", color: "var(--chart-secondary)", kind: "bar" }]} />
            ) : (
              <EmptyState>Sin datos en este rango.</EmptyState>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle>Medias semanales</CardTitle>
        <p className="mb-3 text-xs text-muted">Media de los días registrados (los días sin registro no cuentan como 0).</p>
        {weeks.length ? (
          <div className="-mx-4 relative overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium sm:px-2">Semana</th>
                  <th className="px-2 py-2 text-right font-medium">Días</th>
                  <th className="px-2 py-2 text-right font-medium">Kcal</th>
                  <th className="px-2 py-2 text-right font-medium">Proteína</th>
                  <th className="px-2 py-2 text-right font-medium">Carbos</th>
                  <th className="px-2 py-2 text-right font-medium">Fibra</th>
                </tr>
              </thead>
              <tbody>
                {[...weeks].reverse().map((w) => (
                  <tr key={w.week_start} className={`border-b border-border/60 last:border-0 ${w.partial ? "text-muted" : ""}`}>
                    <td className="px-4 py-2 sm:px-2">
                      {fmtShortDate(w.week_start)} {w.partial && <span className="text-xs">(parcial)</span>}
                    </td>
                    <td className="px-2 py-2 text-right num">{w.days}</td>
                    <td className="px-2 py-2 text-right text-strong num">{fmt(w.kcal, 0)}</td>
                    <td className="px-2 py-2 text-right num">{fmt(w.protein_g, 0)} g</td>
                    <td className="px-2 py-2 text-right num">{fmt(w.carbs_g, 0)} g</td>
                    <td className="px-2 py-2 text-right num">{fmt(w.fiber_g, 0)} g</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>Sin datos en este rango.</EmptyState>
        )}
      </Card>

      {rows.length > 0 && (
        <Card className="mt-6">
          <CardTitle>Días</CardTitle>
          <ul className="mt-3 divide-y divide-border text-sm">
            {[...rows].reverse().slice(0, 30).map((r) => (
              <li key={r.date} className="flex items-center gap-3 py-1">
                <span className="w-36">{fmtDate(r.date)}</span>
                <span className="flex-1 text-muted num">
                  <span className="text-strong">{fmt(r.kcal, 0)} kcal</span> · P {fmt(r.protein_g, 0)} · C {fmt(r.carbs_g, 0)} · F{" "}
                  {fmt(r.fiber_g, 0)}
                </span>
                <DeleteButton url={`/api/nutrition?date=${r.date}`} label="Borrar día" confirmText={`¿Borrar la nutrición del ${fmtDate(r.date)}?`} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
