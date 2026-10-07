import type { Exercise, Workout, WorkoutSet } from "../schemas/workout";
import { monthIndex } from "./months.es";

export type VolumeRule = "all_sets" | "working_sets" | null;

export interface LyftaChecks {
  header_exercises: number | null;
  header_sets: number | null;
  parsed_exercises: number;
  parsed_sets: number;
  volume_all_sets: number;
  volume_working_sets: number;
  /** Which summation reproduces Lyfta's reported volume (null = neither). */
  volume_rule: VolumeRule;
}

export interface ParseResult {
  workout: Workout;
  warnings: string[];
  checks: LyftaChecks;
}

const DATE_RE = /^[\p{L}]+,\s*(\d{1,2}) de (\p{L}+) de (\d{4}),\s*(\d{1,2}):(\d{2})$/u;
const HEADER_RE =
  /^(?:(\d+)\s*h\s*)?(?:(\d+)\s*m(?:in)?)?\s*\|\s*([\d\s.,  ]+?)\s*kg\s*\|\s*(\d+)\s+Ejercicios?\s*\|\s*(\d+)\s+series?$/iu;
const SET_RE =
  /^Serie\s+(\d+):\s*([\d.,]+)\s*kg\s*x\s*(\d+)\s*reps?(?:\s*\((Calentamiento)\))?\s*$/i;

/** Lyfta's share footer ("Mira el entrenamiento y únete a mí en Lyfta." + link). */
const FOOTER_RE = /^(https?:\/\/\S+|.*únete a mí en Lyfta\.?)$/iu;
/** Exercise names are numbered in the export: "1. Lever Military Press". */
const stripNumber = (name: string) => name.replace(/^\d+\.\s+/, "");

/** "6 893.5" → 6893.5, "1.234,5" → 1234.5, "72,5" → 72.5. */
export function parseNumber(raw: string): number {
  let s = raw.replace(/[\s  ]/g, "");
  if (s.includes(",") && s.includes(".")) {
    // The right-most separator is the decimal one.
    s = s.lastIndexOf(",") > s.lastIndexOf(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  return Number(s);
}

const pad = (n: number) => String(n).padStart(2, "0");
const round1 = (x: number) => Math.round(x * 10) / 10;

function volumeMatches(computed: number, reported: number): boolean {
  return Math.abs(computed - reported) <= Math.max(1, reported * 0.005);
}

/**
 * Parses a workout exported from Lyfta as plain text (Spanish locale).
 * Never throws: problems are reported as warnings and `raw_text` is always kept.
 */
export function parseLyfta(text: string): ParseResult {
  const warnings: string[] = [];
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[  ]/g, " ").trim())
    .filter((l) => l.length > 0 && !FOOTER_RE.test(l));

  const workout: Workout = {
    date: "1970-01-01T00:00",
    routine_name: "",
    duration_min: 0,
    total_volume_kg: 0,
    raw_text: text,
    exercises: [],
  };

  let i = 0;
  // 1. Routine name
  if (lines[i] !== undefined && !DATE_RE.test(lines[i]) && !SET_RE.test(lines[i])) {
    workout.routine_name = lines[i++];
  } else {
    warnings.push("No se encontró el nombre de la rutina en la primera línea.");
  }

  // 2. Date
  const dm = lines[i] !== undefined ? DATE_RE.exec(lines[i]) : null;
  if (dm) {
    const [, d, monthName, y, h, min] = dm;
    const m = monthIndex(monthName);
    if (m === undefined) {
      warnings.push(`Mes no reconocido: "${monthName}".`);
    } else {
      workout.date = `${y}-${pad(m + 1)}-${pad(Number(d))}T${pad(Number(h))}:${min}`;
    }
    i++;
  } else {
    warnings.push("No se encontró la fecha (formato esperado: «martes, 7 de octubre de 2025, 18:30»).");
  }

  // 3. Summary header
  let headerExercises: number | null = null;
  let headerSets: number | null = null;
  const hm = lines[i] !== undefined ? HEADER_RE.exec(lines[i]) : null;
  if (hm) {
    const [, hours, minutes, volume, nEx, nSets] = hm;
    workout.duration_min = Number(hours ?? 0) * 60 + Number(minutes ?? 0);
    workout.total_volume_kg = parseNumber(volume);
    headerExercises = Number(nEx);
    headerSets = Number(nSets);
    i++;
  } else {
    warnings.push("No se encontró la cabecera de resumen (duración | volumen | ejercicios | series).");
  }

  // 4. Exercises: state machine over the remaining lines
  let current: Exercise | null = null;
  let pending: string[] = [];

  const flushPendingWithoutSets = () => {
    if (pending.length === 0) return;
    const [rawName, ...notes] = pending;
    const name = stripNumber(rawName);
    workout.exercises.push({ name, notes: notes.length ? notes.join("\n") : null, sets: [] });
    warnings.push(`El ejercicio «${name}» no tiene series.`);
    pending = [];
    current = null;
  };

  for (; i < lines.length; i++) {
    const line = lines[i];
    const sm = SET_RE.exec(line);
    if (!sm) {
      pending.push(line);
      continue;
    }
    const set: WorkoutSet = {
      weight_kg: parseNumber(sm[2]),
      reps: Number(sm[3]),
      is_warmup: Boolean(sm[4]),
    };
    if (pending.length > 0) {
      const [name, ...notes] = pending;
      current = { name: stripNumber(name), notes: notes.length ? notes.join("\n") : null, sets: [] };
      workout.exercises.push(current);
      pending = [];
    }
    if (current) {
      current.sets.push(set);
    } else {
      warnings.push(`Serie fuera de un ejercicio: «${line}».`);
    }
  }
  flushPendingWithoutSets();

  // 5. Checksums
  const allSets = workout.exercises.flatMap((e) => e.sets);
  const volumeAll = round1(allSets.reduce((s, x) => s + x.weight_kg * x.reps, 0));
  const volumeWorking = round1(
    allSets.filter((x) => !x.is_warmup).reduce((s, x) => s + x.weight_kg * x.reps, 0),
  );

  if (headerExercises !== null && headerExercises !== workout.exercises.length) {
    warnings.push(
      `La cabecera indica ${headerExercises} ejercicios y se han leído ${workout.exercises.length}.`,
    );
  }
  if (headerSets !== null && headerSets !== allSets.length) {
    warnings.push(`La cabecera indica ${headerSets} series y se han leído ${allSets.length}.`);
  }

  let volumeRule: VolumeRule = null;
  if (hm) {
    if (volumeMatches(volumeAll, workout.total_volume_kg)) volumeRule = "all_sets";
    else if (volumeMatches(volumeWorking, workout.total_volume_kg)) volumeRule = "working_sets";
    else
      warnings.push(
        `El volumen de Lyfta (${workout.total_volume_kg} kg) no cuadra ni con todas las series (${volumeAll} kg) ni sin calentamientos (${volumeWorking} kg): diferencia ${round1(workout.total_volume_kg - volumeAll)} kg. Las series se guardan tal cual; solo es un aviso.`,
      );
  }

  return {
    workout,
    warnings,
    checks: {
      header_exercises: headerExercises,
      header_sets: headerSets,
      parsed_exercises: workout.exercises.length,
      parsed_sets: allSets.length,
      volume_all_sets: volumeAll,
      volume_working_sets: volumeWorking,
      volume_rule: volumeRule,
    },
  };
}
