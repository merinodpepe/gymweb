import type { ScatterCross } from "@/domain/insights/crosses";
import { MIN_PAIRS, strengthWord } from "@/domain/stats/correlation";
import { fmt, fmtSigned } from "@/lib/format";
import { ScatterPlot } from "./scatter-chart";
import { Badge, Card, CardTitle, EmptyState } from "./ui";

/** One relation: scatter plot, the coefficient only when there are enough pairs, and the cautions. */
export function CrossCard({ c, children }: { c: ScatterCross; children?: React.ReactNode }) {
  const r = c.relation;
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>{c.title}</CardTitle>
          <p className="text-sm text-muted">{c.question}</p>
        </div>
        {r.enough && (
          <Badge className={c.survives ? "border-good/60 text-good" : undefined}>
            {c.survives ? "Relación observada" : "Sin relación clara"}
          </Badge>
        )}
      </div>

      <div className="mt-3">
        {c.points.length ? (
          <ScatterPlot
            points={c.points}
            xLabel={c.xLabel}
            yLabel={c.yLabel}
            xUnit={c.xUnit}
            yUnit={c.yUnit}
            ariaLabel={`Dispersión: ${c.title}`}
          />
        ) : (
          <EmptyState>Aún no hay pares de datos para este cruce.</EmptyState>
        )}
      </div>

      <p className="mt-3 text-sm text-text num">
        <span className="font-medium text-strong">n = {r.n}</span> pares
        {r.enough && r.rho !== null && r.ci95 ? (
          <>
            {" · "}Spearman ρ = <span className="font-medium text-strong">{fmtSigned(r.rho, 2)}</span> (IC 95 %: {fmtSigned(r.ci95[0], 2)} a{" "}
            {fmtSigned(r.ci95[1], 2)}) · relación {strengthWord(r.rho)}
            {c.survives ? " y sobrevive a la corrección por comparaciones múltiples" : " (no sobrevive a la corrección por comparaciones múltiples)"}
          </>
        ) : (
          <span className="text-muted"> · hacen falta al menos {MIN_PAIRS} para calcular un coeficiente: de momento solo el gráfico.</span>
        )}
      </p>
      {c.lag && r.enough && (
        <p className="mt-1 text-xs text-muted">
          Mejor retardo: {fmt(c.lag.weeks, 0)} {c.lag.weeks === 1 ? "semana" : "semanas"} (se probaron {c.lag.tried}; probar varios infla el azar).
        </p>
      )}
      {children}
      <p className="mt-2 text-xs text-muted">{c.caveat}</p>
    </Card>
  );
}
