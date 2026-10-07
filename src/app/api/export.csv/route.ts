import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, handle } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import { bodyRepo } from "@/repositories/bodyRepo";
import { exerciseAliasRepo } from "@/repositories/exerciseAliasRepo";
import { nutritionRepo } from "@/repositories/nutritionRepo";
import { runRepo } from "@/repositories/runRepo";
import { workoutRepo } from "@/repositories/workoutRepo";

const Table = z.enum(["body_log", "runs", "nutrition_log", "workouts", "workout_sets", "exercise_alias"]);

async function rowsFor(table: z.infer<typeof Table>): Promise<Record<string, unknown>[]> {
  switch (table) {
    case "body_log":
      return bodyRepo.list();
    case "runs":
      return runRepo.list();
    case "nutrition_log":
      return nutritionRepo.list();
    case "exercise_alias":
      return exerciseAliasRepo.list();
    case "workouts":
      return (await workoutRepo.list({}, 100_000)).map(({ exercises, ...w }) => ({
        ...w,
        exercises: exercises.length,
      }));
    case "workout_sets":
      return (await workoutRepo.list({}, 100_000)).flatMap((w) =>
        w.exercises.flatMap((e) =>
          e.sets.map((s, i) => ({
            workout_id: w.id,
            date: w.date,
            routine_name: w.routine_name,
            exercise: e.name,
            canonical_name: e.canonical_name,
            set: i + 1,
            weight_kg: s.weight_kg,
            reps: s.reps,
            is_warmup: s.is_warmup,
          })),
        ),
      );
  }
}

export const GET = handle(async (req: NextRequest) => {
  const table = Table.safeParse(req.nextUrl.searchParams.get("table"));
  if (!table.success) return badRequest(table.error);
  return new NextResponse(toCsv(await rowsFor(table.data)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${table.data}.csv"`,
    },
  });
});
