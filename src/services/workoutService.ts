import "server-only";
import { parseLyfta } from "@/domain/lyfta/parseLyfta";
import { exerciseAliasRepo } from "@/repositories/exerciseAliasRepo";
import { fillMissingMuscleGroups } from "@/services/muscleService";
import { workoutRepo } from "@/repositories/workoutRepo";

export async function previewWorkout(rawText: string) {
  return parseLyfta(rawText, { dumbbells: await exerciseAliasRepo.dumbbells() });
}

export type SaveResult =
  | { status: "created" | "replaced"; id: string; warnings: string[] }
  | { status: "duplicate"; existingId: string }
  | { status: "invalid"; warnings: string[] };

export async function saveWorkout(rawText: string, replace = false): Promise<SaveResult> {
  const { workout, warnings, checks } = parseLyfta(rawText, { dumbbells: await exerciseAliasRepo.dumbbells() });
  if (!workout.routine_name || workout.date.startsWith("1970") || workout.exercises.length === 0) {
    return { status: "invalid", warnings };
  }
  const existing = await workoutRepo.findByKey(workout.date, workout.routine_name);
  if (existing && !replace) return { status: "duplicate", existingId: existing.id };

  const aliases = await exerciseAliasRepo.map();
  const canonical = (name: string) => aliases.get(name)?.canonical_name ?? name;
  const id = await workoutRepo.save(workout, canonical, warnings, existing?.id);
  // Remember exercises deduced from Lyfta's volume, and fix their older workouts too.
  await exerciseAliasRepo.markDumbbells(checks.dumbbell_inferred);
  await fillMissingMuscleGroups(workout.exercises.map((e) => e.name));
  return { status: existing ? "replaced" : "created", id, warnings };
}
