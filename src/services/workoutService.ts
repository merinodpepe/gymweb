import "server-only";
import { parseLyfta } from "@/domain/lyfta/parseLyfta";
import { exerciseAliasRepo } from "@/repositories/exerciseAliasRepo";
import { workoutRepo } from "@/repositories/workoutRepo";

export function previewWorkout(rawText: string) {
  return parseLyfta(rawText);
}

export type SaveResult =
  | { status: "created" | "replaced"; id: string; warnings: string[] }
  | { status: "duplicate"; existingId: string }
  | { status: "invalid"; warnings: string[] };

export async function saveWorkout(rawText: string, replace = false): Promise<SaveResult> {
  const { workout, warnings } = parseLyfta(rawText);
  if (!workout.routine_name || workout.date.startsWith("1970") || workout.exercises.length === 0) {
    return { status: "invalid", warnings };
  }
  const existing = await workoutRepo.findByKey(workout.date, workout.routine_name);
  if (existing && !replace) return { status: "duplicate", existingId: existing.id };

  const aliases = await exerciseAliasRepo.map();
  const canonical = (name: string) => aliases.get(name)?.canonical_name ?? name;
  const id = await workoutRepo.save(workout, canonical, warnings, existing?.id);
  return { status: existing ? "replaced" : "created", id, warnings };
}
