import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { exerciseAlias, workoutExercises } from "@/db/schema";
import type { Alias } from "@/domain/schemas/workout";

export interface ExerciseAliasRepo {
  list(): Promise<Alias[]>;
  /** raw name → alias (canonical name + muscle group). */
  map(): Promise<Map<string, Alias>>;
  /** Upserts the alias and re-labels already stored exercises with that raw name. */
  upsert(alias: Alias): Promise<void>;
}

export const exerciseAliasRepo: ExerciseAliasRepo = {
  async list() {
    const rows = await getDb().select().from(exerciseAlias).orderBy(asc(exerciseAlias.rawName));
    return rows.map((r) => ({ raw_name: r.rawName, canonical_name: r.canonicalName, muscle_group: r.muscleGroup }));
  },
  async map() {
    return new Map((await this.list()).map((a) => [a.raw_name, a]));
  },
  async upsert(a) {
    const db = getDb();
    const values = { rawName: a.raw_name, canonicalName: a.canonical_name, muscleGroup: a.muscle_group || null };
    await db.batch([
      db.insert(exerciseAlias).values(values).onConflictDoUpdate({ target: exerciseAlias.rawName, set: values }),
      db
        .update(workoutExercises)
        .set({ canonicalName: a.canonical_name })
        .where(eq(workoutExercises.name, a.raw_name)),
    ]);
  },
};
