import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { WorkoutSet } from "@/domain/schemas/workout";

export const bodyLog = pgTable("body_log", {
  date: date("date", { mode: "string" }).primaryKey(),
  weightKg: numeric("weight_kg", { precision: 5, scale: 2 }),
  steps: integer("steps"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date", { mode: "string" }).notNull(),
    distanceKm: numeric("distance_km", { precision: 6, scale: 2 }).notNull(),
    durationS: integer("duration_s").notNull(),
    elevationGainM: integer("elevation_gain_m").notNull().default(0),
    surface: text("surface", { enum: ["treadmill", "outdoor"] }).notNull(),
    notes: text("notes"),
  },
  (t) => [
    check("runs_distance_pos", sql`${t.distanceKm} > 0`),
    check("runs_duration_pos", sql`${t.durationS} > 0`),
    check("runs_surface", sql`${t.surface} in ('treadmill','outdoor')`),
    index("runs_date_idx").on(t.date),
  ],
);

/** Independent table: no FK or join with body_log. */
export const nutritionLog = pgTable("nutrition_log", {
  date: date("date", { mode: "string" }).primaryKey(),
  kcal: integer("kcal").notNull(),
  proteinG: numeric("protein_g", { precision: 5, scale: 1 }).notNull(),
  carbsG: numeric("carbs_g", { precision: 5, scale: 1 }).notNull(),
  fiberG: numeric("fiber_g", { precision: 5, scale: 1 }).notNull(),
});

export const workouts = pgTable(
  "workouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Local wall-clock time as shown by Lyfta (no time zone conversion). */
    date: timestamp("date", { mode: "string" }).notNull(),
    routineName: text("routine_name").notNull(),
    durationMin: integer("duration_min").notNull(),
    totalVolumeKg: numeric("total_volume_kg", { precision: 8, scale: 1 }).notNull(),
    rawText: text("raw_text").notNull(),
    parseWarnings: jsonb("parse_warnings").$type<string[]>().notNull().default([]),
  },
  (t) => [unique("workouts_date_routine").on(t.date, t.routineName)],
);

export const workoutExercises = pgTable(
  "workout_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    canonicalName: text("canonical_name").notNull(),
    notes: text("notes"),
    sets: jsonb("sets").$type<WorkoutSet[]>().notNull(),
  },
  (t) => [index("we_workout_idx").on(t.workoutId), index("we_canonical_idx").on(t.canonicalName)],
);

export const exerciseAlias = pgTable("exercise_alias", {
  rawName: text("raw_name").primaryKey(),
  canonicalName: text("canonical_name").notNull(),
  muscleGroup: text("muscle_group"),
});
