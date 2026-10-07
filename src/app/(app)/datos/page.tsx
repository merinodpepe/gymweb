import { Download } from "lucide-react";
import { connection } from "next/server";
import { DbMissing, hasDatabase } from "@/components/db-missing";
import { AliasForm } from "@/components/forms/alias-form";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { exerciseAliasRepo } from "@/repositories/exerciseAliasRepo";
import { workoutRepo } from "@/repositories/workoutRepo";

export const metadata = { title: "Datos" };

const EXPORTS = [
  ["body_log", "Peso y pasos"],
  ["runs", "Carreras"],
  ["nutrition_log", "Nutrición"],
  ["workouts", "Entrenos (resumen)"],
  ["workout_sets", "Entrenos (una fila por serie)"],
  ["exercise_alias", "Alias de ejercicios"],
] as const;

export default async function DataPage() {
  await connection();
  if (!hasDatabase())
    return (
      <>
        <PageHeader title="Datos" />
        <DbMissing />
      </>
    );
  const [aliases, rawNames] = await Promise.all([
    exerciseAliasRepo.list(),
    workoutRepo.exerciseHistory().then((rows) => [...new Set(rows.map((r) => r.name))].sort()),
  ]);

  return (
    <>
      <PageHeader title="Datos" subtitle="Alias de ejercicios y copias de seguridad." />

      <Card>
        <CardTitle>Alias de ejercicios</CardTitle>
        <p className="mb-4 text-xs text-muted">
          Unifica nombres entre rutinas (p. ej. «Lever Military Press» y «Machine Shoulder Press» → «Press hombro») y asigna
          el grupo muscular para el volumen semanal. Se aplica también a los entrenos ya guardados.
        </p>
        <AliasForm names={rawNames} />
        {aliases.length ? (
          <div className="-mx-4 mt-5 relative overflow-x-auto sm:mx-0">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium sm:px-2">Nombre en Lyfta</th>
                  <th className="px-2 py-2 font-medium">Canónico</th>
                  <th className="px-2 py-2 font-medium">Grupo</th>
                </tr>
              </thead>
              <tbody>
                {aliases.map((a) => (
                  <tr key={a.raw_name} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2 sm:px-2">{a.raw_name}</td>
                    <td className="px-2 py-2 text-strong">{a.canonical_name}</td>
                    <td className="px-2 py-2">{a.muscle_group ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState>Sin alias todavía.</EmptyState>
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <CardTitle>Exportar CSV</CardTitle>
        <p className="mb-4 text-xs text-muted">
          Copia manual. Además, una GitHub Action guarda un <code>pg_dump</code> mensual (ver SETUP.md).
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {EXPORTS.map(([table, label]) => (
            <li key={table}>
              <a
                href={`/api/export.csv?table=${table}`}
                className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm hover:border-accent hover:text-strong"
              >
                <Download aria-hidden className="size-4 text-accent" />
                {label}
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
