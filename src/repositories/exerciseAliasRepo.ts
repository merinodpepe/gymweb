import "server-only";
import { asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { exerciseAlias, workoutExercises } from "@/db/schema";
import type { Alias } from "@/domain/schemas/workout";

export interface ExerciseAliasRepo {
  list(): Promise<Alias[]>;
  /** raw name → alias (canonical name + muscle group). */
  map(): Promise<Map<string, Alias>>;
  /** Raw names marked as dumbbell exercises. */
  dumbbells(): Promise<Set<string>>;
  /** Upserts the alias and re-labels already stored exercises with that raw name. */
  upsert(alias: Alias): Promise<void>;
  /** Marks exercises as dumbbell work (creating the alias if needed) and flags their stored sets. */
  markDumbbells(rawNames: readonly string[]): Promise<void>;
  /** Sets muscle groups (creating the alias if needed) but never overwrites one that is already set. */
  fillMuscleGroups(groups: ReadonlyMap<string, string>): Promise<void>;
}

/** Adds or removes `dumbbell_pair` on every stored set of the exercises with these raw names. */
function flagStoredSets(rawNames: readonly string[], dumbbell: boolean) {
  const edit = dumbbell ? sql`elem || '{"dumbbell_pair": true}'::jsonb` : sql`elem - 'dumbbell_pair'`;
  return getDb()
    .update(workoutExercises)
    .set({
      sets: sql`(
        select coalesce(jsonb_agg(${edit} order by ord), '[]'::jsonb)
        from jsonb_array_elements(${workoutExercises.sets}) with ordinality as t(elem, ord)
      )`,
    })
    .where(inArray(workoutExercises.name, [...rawNames]));
}

export const exerciseAliasRepo: ExerciseAliasRepo = {
  async list() {
    const rows = await getDb().select().from(exerciseAlias).orderBy(asc(exerciseAlias.rawName));
    return rows.map((r) => ({
      raw_name: r.rawName,
      canonical_name: r.canonicalName,
      muscle_group: r.muscleGroup,
      dumbbell: r.dumbbell,
    }));
  },
  async map() {
    return new Map((await this.list()).map((a) => [a.raw_name, a]));
  },
  async dumbbells() {
    const rows = await getDb()
      .select({ rawName: exerciseAlias.rawName })
      .from(exerciseAlias)
      .where(eq(exerciseAlias.dumbbell, true));
    return new Set(rows.map((r) => r.rawName));
  },
  async upsert(a) {
    const db = getDb();
    const values = {
      rawName: a.raw_name,
      canonicalName: a.canonical_name,
      muscleGroup: a.muscle_group || null,
      dumbbell: a.dumbbell,
    };
    await db.batch([
      db.insert(exerciseAlias).values(values).onConflictDoUpdate({ target: exerciseAlias.rawName, set: values }),
      db
        .update(workoutExercises)
        .set({ canonicalName: a.canonical_name })
        .where(eq(workoutExercises.name, a.raw_name)),
      flagStoredSets([a.raw_name], a.dumbbell),
    ]);
  },
  async markDumbbells(rawNames) {
    if (!rawNames.length) return;
    const db = getDb();
    await db.batch([
      db
        .insert(exerciseAlias)
        .values(rawNames.map((n) => ({ rawName: n, canonicalName: n, dumbbell: true })))
        .onConflictDoUpdate({ target: exerciseAlias.rawName, set: { dumbbell: true } }),
      flagStoredSets(rawNames, true),
    ]);
  },
  async fillMuscleGroups(groups) {
    if (!groups.size) return;
    await getDb()
      .insert(exerciseAlias)
      .values([...groups].map(([n, g]) => ({ rawName: n, canonicalName: n, muscleGroup: g })))
      .onConflictDoUpdate({
        target: exerciseAlias.rawName,
        set: { muscleGroup: sql`excluded.muscle_group` },
        setWhere: isNull(exerciseAlias.muscleGroup),
      });
  },
};
