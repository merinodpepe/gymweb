import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { exerciseAliasRepo } from "@/repositories/exerciseAliasRepo";
import { fillMissingMuscleGroups } from "@/services/muscleService";
import { workoutRepo } from "@/repositories/workoutRepo";

export const POST = handle(async () => {
  const [aliases, history] = await Promise.all([exerciseAliasRepo.list(), workoutRepo.exerciseHistory()]);
  const names = [...aliases.map((a) => a.raw_name), ...history.map((r) => r.name)];
  return NextResponse.json(await fillMissingMuscleGroups(names));
});
