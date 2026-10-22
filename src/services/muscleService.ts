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

/**
 * Resolves the muscle group (manual alias first, then the dataset match) and the secondary muscles of an exercise.
 * Loads the aliases once; the returned functions are synchronous.
 */
export async function loadMuscleResolver() {
  const aliases = await exerciseAliasRepo.list();
  const groupOf = new Map<string, string>();
  for (const a of aliases) if (a.muscle_group) groupOf.set(a.raw_name, a.muscle_group);
  for (const a of aliases) if (a.muscle_group && !groupOf.has(a.canonical_name)) groupOf.set(a.canonical_name, a.muscle_group);

  const rows = dataset as unknown as DatasetRow[];
  const cache = new Map<string, ReturnType<typeof matchMuscle>>();
  const matchOf = (name: string) => {
    let m = cache.get(name);
    if (!m) cache.set(name, (m = matchMuscle(name, rows)));
    return m;
  };
  return {
    group: (name: string, canonical: string) => groupOf.get(name) ?? groupOf.get(canonical) ?? matchOf(name).group,
    secondary: (name: string) => matchOf(name).secondary,
  };
}
