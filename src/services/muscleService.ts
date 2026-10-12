import "server-only";
import dataset from "@/data/exercises.json";
import { type DatasetRow, matchMuscle } from "@/domain/muscles/matchMuscle";
import { exerciseAliasRepo } from "@/repositories/exerciseAliasRepo";

/** Fills the muscle group of exercises that have none yet; manual groups are never touched. */
export async function fillMissingMuscleGroups(rawNames: readonly string[]) {
  const aliases = await exerciseAliasRepo.map();
  const missing = [...new Set(rawNames)].filter((n) => !aliases.get(n)?.muscle_group);
  const found = new Map<string, string>();
  for (const n of missing) {
    const { group } = matchMuscle(n, dataset as unknown as DatasetRow[]);
    if (group) found.set(n, group);
  }
  await exerciseAliasRepo.fillMuscleGroups(found);
  return { filled: found.size, unmatched: missing.filter((n) => !found.has(n)) };
}
