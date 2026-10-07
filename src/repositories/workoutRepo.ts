import "server-only";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { workoutExercises, workouts } from "@/db/schema";
import type { Workout, WorkoutSet } from "@/domain/schemas/workout";

export interface StoredExercise {
  position: number;
  name: string;
  canonical_name: string;
  notes: string | null;
  sets: WorkoutSet[];
}

export interface StoredWorkout extends Omit<Workout, "exercises"> {
  id: string;
  parse_warnings: string[];
  exercises: StoredExercise[];
}

export interface ExerciseHistoryRow {
  date: string; // YYYY-MM-DDTHH:mm
  name: string;
  canonical_name: string;
  sets: WorkoutSet[];
}

export interface WorkoutRepo {
  list(range?: { from?: string; to?: string }, limit?: number): Promise<StoredWorkout[]>;
  get(id: string): Promise<StoredWorkout | null>;
  findByKey(date: string, routineName: string): Promise<{ id: string } | null>;
  /** Inserts workout + exercises atomically; replaces `replaceId` in the same batch. */
  save(w: Workout, canonical: (name: string) => string, warnings: string[], replaceId?: string): Promise<string>;
  remove(id: string): Promise<void>;
  exerciseHistory(canonicalName?: string): Promise<ExerciseHistoryRow[]>;
  canonicalNames(): Promise<string[]>;
}

/** Drizzle returns `2025-10-07 18:32:00`; the domain uses `2025-10-07T18:32`. */
const normDate = (d: string) => d.replace(" ", "T").slice(0, 16);
const toDbDate = (d: string) => `${d.replace("T", " ")}:00`;

async function hydrate(rows: (typeof workouts.$inferSelect)[]): Promise<StoredWorkout[]> {
  if (!rows.length) return [];
  const ex = await getDb()
    .select()
    .from(workoutExercises)
    .where(inArray(workoutExercises.workoutId, rows.map((r) => r.id)))
    .orderBy(asc(workoutExercises.position));
  return rows.map((r) => ({
    id: r.id,
    date: normDate(r.date),
    routine_name: r.routineName,
    duration_min: r.durationMin,
    total_volume_kg: Number(r.totalVolumeKg),
    raw_text: r.rawText,
    parse_warnings: r.parseWarnings,
    exercises: ex
      .filter((e) => e.workoutId === r.id)
      .map((e) => ({
        position: e.position,
        name: e.name,
        canonical_name: e.canonicalName,
        notes: e.notes,
        sets: e.sets,
      })),
  }));
}

export const workoutRepo: WorkoutRepo = {
  async list(range = {}, limit = 200) {
    const rows = await getDb()
      .select()
      .from(workouts)
      .where(
        and(
          range.from ? gte(workouts.date, `${range.from} 00:00:00`) : undefined,
          range.to ? lte(workouts.date, `${range.to} 23:59:59`) : undefined,
        ),
      )
      .orderBy(desc(workouts.date))
      .limit(limit);
    return hydrate(rows);
  },

  async get(id) {
    const rows = await getDb().select().from(workouts).where(eq(workouts.id, id));
    return (await hydrate(rows))[0] ?? null;
  },

  async findByKey(date, routineName) {
    const [row] = await getDb()
      .select({ id: workouts.id })
      .from(workouts)
      .where(and(eq(workouts.date, toDbDate(date)), eq(workouts.routineName, routineName)));
    return row ?? null;
  },

  async save(w, canonical, warnings, replaceId) {
    const db = getDb();
    const id = crypto.randomUUID();
    const insertWorkout = db.insert(workouts).values({
      id,
      date: toDbDate(w.date),
      routineName: w.routine_name,
      durationMin: w.duration_min,
      totalVolumeKg: String(w.total_volume_kg),
      rawText: w.raw_text,
      parseWarnings: warnings,
    });
    const exRows = w.exercises.map((e, position) => ({
      workoutId: id,
      position,
      name: e.name,
      canonicalName: canonical(e.name),
      notes: e.notes,
      sets: e.sets,
    }));
    const steps = [
      ...(replaceId ? [db.delete(workouts).where(eq(workouts.id, replaceId))] : []),
      insertWorkout,
      ...(exRows.length ? [db.insert(workoutExercises).values(exRows)] : []),
    ] as const;
    // neon-http has no interactive transactions; batch() runs atomically.
    await db.batch(steps as unknown as Parameters<typeof db.batch>[0]);
    return id;
  },

  async remove(id) {
    await getDb().delete(workouts).where(eq(workouts.id, id));
  },

  async exerciseHistory(canonicalName) {
    const rows = await getDb()
      .select({
        date: workouts.date,
        name: workoutExercises.name,
        canonical_name: workoutExercises.canonicalName,
        sets: workoutExercises.sets,
      })
      .from(workoutExercises)
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .where(canonicalName ? eq(workoutExercises.canonicalName, canonicalName) : undefined)
      .orderBy(asc(workouts.date), asc(workoutExercises.position));
    return rows.map((r) => ({ ...r, date: normDate(r.date) }));
  },

  async canonicalNames() {
    const rows = await getDb()
      .selectDistinct({ name: workoutExercises.canonicalName })
      .from(workoutExercises)
      .orderBy(asc(workoutExercises.canonicalName));
    return rows.map((r) => r.name);
  },
};
