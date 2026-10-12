import type { Exercise, Workout, WorkoutSet } from "../schemas/workout";
import { setVolume } from "../stats/load";
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
  /** Exercises deduced to be dumbbell work because only they explain Lyfta's volume. */
  dumbbell_inferred: string[];
}

export interface ParseOptions {
  /** Exercise names (as in Lyfta) already known to be done with dumbbells. */
  dumbbells?: ReadonlySet<string>;
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
/** Bodyweight exercises carry Lyfta's profile weight: "Weighted Pull-Up(+ BW 90 kg)". */
const BODYWEIGHT_RE = /\s*\(\s*\+\s*BW\s*([\d.,]+)\s*kg\s*\)\s*$/i;

/** "1. Chest Dip(+ BW 90 kg)" → { name: "Chest Dip", bodyweight: 90 }. */
function parseExerciseName(raw: string): { name: string; bodyweight: number | undefined } {
  const name = stripNumber(raw);
  const bw = BODYWEIGHT_RE.exec(name);
  if (!bw) return { name, bodyweight: undefined };
  return { name: name.slice(0, bw.index).trim(), bodyweight: parseNumber(bw[1]) };
}

/** Names that say it themselves; anything else is learned from Lyfta's volume. */
const DUMBBELL_NAME_RE = /dumbbell|mancuerna|\bDB\b/i;
const MAX_INFERRED = 3;

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

const sumVolume = (sets: readonly WorkoutSet[]) => round1(sets.reduce((t, x) => t + setVolume(x), 0));

/**
 * Lyfta counts dumbbells twice, but its export doesn't say which exercises use them.
 * Finds the subsets of (up to 3) exercises whose volume equals the unexplained gap,
 * under either volume rule. Returns the exercise indexes only if exactly one subset fits.
 */
function inferDumbbells(exercises: readonly Exercise[], reported: number): number[] | "ambiguous" | null {
  const candidates = exercises
    .map((e, i) => ({ i, all: sumVolume(e.sets), working: sumVolume(e.sets.filter((x) => !x.is_warmup)) }))
    .filter((c) => c.all > 0 && !exercises[c.i].sets[0]?.dumbbell_pair);
  const allSets = exercises.flatMap((e) => e.sets);
  const gaps = {
    all: round1(reported - sumVolume(allSets)),
    working: round1(reported - sumVolume(allSets.filter((x) => !x.is_warmup))),
  };
  const matches = new Set<string>();
  const walk = (start: number, picked: typeof candidates) => {
    if (picked.length) {
      for (const rule of ["all", "working"] as const) {
        const v = round1(picked.reduce((t, c) => t + c[rule], 0));
        if (gaps[rule] > 0 && Math.abs(v - gaps[rule]) < 0.05) matches.add(picked.map((c) => c.i).join(","));
      }
    }
    if (picked.length === MAX_INFERRED) return;
    for (let k = start; k < candidates.length; k++) walk(k + 1, [...picked, candidates[k]]);
  };
  walk(0, []);
  if (matches.size === 0) return null;
  if (matches.size > 1) return "ambiguous";
  return [...matches][0].split(",").map(Number);
}

/**
 * Parses a workout exported from Lyfta as plain text (Spanish locale).
 * Never throws: problems are reported as warnings and `raw_text` is always kept.
 */
export function parseLyfta(text: string, { dumbbells = new Set() }: ParseOptions = {}): ParseResult {
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
    notes: null,
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

  // 3. Optional workout comment, then the summary header. The comment is every line
  //    before the header, as long as no set line comes first.
  let headerExercises: number | null = null;
  let headerSets: number | null = null;
  let headerAt = i;
  while (headerAt < lines.length && !HEADER_RE.test(lines[headerAt]) && !SET_RE.test(lines[headerAt])) headerAt++;
  const hm = lines[headerAt] !== undefined ? HEADER_RE.exec(lines[headerAt]) : null;
  if (hm) {
    if (headerAt > i) workout.notes = lines.slice(i, headerAt).join("\n");
    i = headerAt;
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
  let currentBodyweight: number | undefined;
  let currentDumbbell = false;
  let pending: string[] = [];

  const flushPendingWithoutSets = () => {
    if (pending.length === 0) return;
    const [rawName, ...notes] = pending;
    const { name } = parseExerciseName(rawName);
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
    if (pending.length > 0) {
      const [rawName, ...notes] = pending;
      const { name, bodyweight } = parseExerciseName(rawName);
      current = { name, notes: notes.length ? notes.join("\n") : null, sets: [] };
      currentBodyweight = bodyweight;
      currentDumbbell = dumbbells.has(name) || DUMBBELL_NAME_RE.test(name);
      workout.exercises.push(current);
      pending = [];
    }
    const set: WorkoutSet = {
      weight_kg: parseNumber(sm[2]),
      reps: Number(sm[3]),
      is_warmup: Boolean(sm[4]),
      ...(currentBodyweight !== undefined && { bodyweight_kg: currentBodyweight }),
      ...(currentDumbbell && { dumbbell_pair: true as const }),
    };
    if (current) {
      current.sets.push(set);
    } else {
      warnings.push(`Serie fuera de un ejercicio: «${line}».`);
    }
  }
  flushPendingWithoutSets();

  // 5. Checksums. If Lyfta's volume is off, try to explain it with dumbbell exercises.
  const allSets = workout.exercises.flatMap((e) => e.sets);
  const reported = workout.total_volume_kg;
  const explained = () =>
    volumeMatches(sumVolume(allSets), reported) ||
    volumeMatches(sumVolume(allSets.filter((x) => !x.is_warmup)), reported);
  const dumbbellInferred: string[] = [];
  if (hm && !explained()) {
    const found = inferDumbbells(workout.exercises, reported);
    if (found === "ambiguous") {
      warnings.push(
        "La diferencia de volumen con Lyfta encaja con varios grupos de ejercicios: no se puede saber cuáles son con mancuernas. Márcalos en Datos → Alias.",
      );
    } else if (found) {
      for (const i of found) {
        const e = workout.exercises[i];
        e.sets = e.sets.map((x) => ({ ...x, dumbbell_pair: true as const }));
        dumbbellInferred.push(e.name);
      }
      allSets.splice(0, allSets.length, ...workout.exercises.flatMap((e) => e.sets));
    }
  }
  const volumeAll = sumVolume(allSets);
  const volumeWorking = sumVolume(allSets.filter((x) => !x.is_warmup));

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
      dumbbell_inferred: dumbbellInferred,
    },
  };
}
