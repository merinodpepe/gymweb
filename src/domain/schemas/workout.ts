import { z } from "zod";
import { LocalDateTime } from "./common";

export const SetSchema = z.object({
  weight_kg: z.number().nonnegative(),
  reps: z.number().int().positive(),
  is_warmup: z.boolean(),
});

export const ExerciseSchema = z.object({
  name: z.string().min(1),
  notes: z.string().nullable(),
  sets: z.array(SetSchema),
});

export const WorkoutSchema = z.object({
  id: z.string().uuid().optional(),
  date: LocalDateTime,
  routine_name: z.string().min(1),
  duration_min: z.number().int().nonnegative(),
  total_volume_kg: z.number().nonnegative(),
  raw_text: z.string(),
  exercises: z.array(ExerciseSchema),
});

export type WorkoutSet = z.infer<typeof SetSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type Workout = z.infer<typeof WorkoutSchema>;

/** Body of POST /api/workouts: the raw Lyfta text (parsed on the server). */
export const SaveWorkoutSchema = z.object({
  raw_text: z.string().min(10),
  replace: z.boolean().optional().default(false),
});

export const AliasSchema = z.object({
  raw_name: z.string().trim().min(1),
  canonical_name: z.string().trim().min(1),
  muscle_group: z.string().trim().max(60).optional().nullable(),
});
export type Alias = z.infer<typeof AliasSchema>;
