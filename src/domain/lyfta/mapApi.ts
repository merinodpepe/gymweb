import type { Exercise, Workout, WorkoutSet } from "../schemas/workout";
import { setVolume } from "../stats/load";

/** One set as returned by `GET /api/v1/workouts` (numbers arrive as strings, empties as "" / "null"). */
export interface ApiSet {
  weight: string | number | null;
  reps: string | number | null;
  set_type_id: string | number | null;
}

export interface ApiExercise {
  excercise_name: string;
  exercise_type: string | null;
  sets: ApiSet[];
}

export interface ApiWorkout {
  id: number | string;
  title: string;
  body_weight: number | string | null;
  /** UTC, `YYYY-MM-DD HH:mm:ss` (or ISO). */
  workout_perform_date: string;
  total_volume: number | string | null;
  exercises: ApiExercise[];
}

/** Header-only data from `GET /api/v1/workouts/summary` (duration and workout comment live only there). */
export interface ApiSummary {
  id: number | string;
  description: string | null;
  workout_duration: string | null;
}

/** Lyfta's `set_type_id` for a warm-up set. */
const WARMUP_SET_TYPE = 1;
/**
 * The only exercise type whose volume Lyfta doubles: two dumbbells moved together. One-dumbbell types
 * (`db_1_alt_sides`, `db_1_both_sides`) count once. Checked against all 89 workouts of the real account.
 */
const DUMBBELL_PAIR_TYPE = "db_2_simultaneous";
/** Cardio rows (no reps) are not strength sets. */
const CARDIO_TYPE = "distance_duration";
/** Exercise type whose reps carry the user's bodyweight (weight = added load). */
const BODYWEIGHT_TYPE = "full_bodyweight";

const pad = (n: number) => String(n).padStart(2, "0");
const round1 = (x: number) => Math.round(x * 10) / 10;

const toNumber = (v: string | number | null | undefined): number => {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

/** "2026-10-10 09:43:49" (UTC) → "2026-10-10T11:43" in the given time zone. */
export function utcToLocal(utc: string, timeZone: string): string {
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(utc) ? utc : `${utc.trim().replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return "1970-01-01T00:00";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${pad(Number(p.hour))}:${p.minute}`;
}

/** "01:06:59" → 67 minutes (rounded like Lyfta's "1h 7m"). */
export function durationMinutes(hms: string | null | undefined): number {
  const m = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(hms ?? "");
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]) + (Number(m[3] ?? 0) >= 30 ? 1 : 0);
}

export interface MapOptions {
  timeZone: string;
  /** Exercise names (as in Lyfta) the user marked as dumbbell work, on top of Lyfta's own exercise type. */
  dumbbells?: ReadonlySet<string>;
}

/**
 * Converts an API workout into the app's `Workout`, the same shape the text parser produces.
 * `raw_text` keeps the source JSON so nothing is lost.
 */
export function mapApiWorkout(w: ApiWorkout, summary: ApiSummary | undefined, { timeZone, dumbbells = new Set() }: MapOptions) {
  const bodyweight = toNumber(w.body_weight);
  const warnings: string[] = [];

  const exercises: Exercise[] = w.exercises.flatMap((e) => {
    const name = e.excercise_name.trim();
    const dumbbell = e.exercise_type === DUMBBELL_PAIR_TYPE || dumbbells.has(name);
    const bw = e.exercise_type === BODYWEIGHT_TYPE && bodyweight > 0 ? bodyweight : undefined;
    const sets: WorkoutSet[] = e.sets
      .filter((s) => toNumber(s.reps) > 0)
      .map((s) => ({
        weight_kg: toNumber(s.weight),
        reps: Math.round(toNumber(s.reps)),
        is_warmup: toNumber(s.set_type_id) === WARMUP_SET_TYPE,
        ...(bw !== undefined && { bodyweight_kg: bw }),
        ...(dumbbell && { dumbbell_pair: true as const }),
      }));
    if (!sets.length) {
      if (e.exercise_type !== CARDIO_TYPE) warnings.push(`El ejercicio «${name}» no tiene series con repeticiones y se ha omitido.`);
      return [];
    }
    return [{ name, notes: null, sets }];
  });

  const reported = toNumber(w.total_volume);
  const computed = round1(exercises.flatMap((x) => x.sets).reduce((t, x) => t + setVolume(x), 0));
  if (reported > 0 && Math.abs(computed - reported) > Math.max(1, reported * 0.005)) {
    warnings.push(
      `El volumen de Lyfta (${reported} kg) no cuadra con el calculado (${computed} kg). Las series se guardan tal cual; solo es un aviso.`,
    );
  }

  const workout: Workout = {
    date: utcToLocal(w.workout_perform_date, timeZone),
    routine_name: w.title.trim(),
    duration_min: durationMinutes(summary?.workout_duration),
    total_volume_kg: reported || computed,
    notes: summary?.description?.trim() || null,
    raw_text: JSON.stringify(w),
    exercises,
  };
  return { workout, warnings };
}
