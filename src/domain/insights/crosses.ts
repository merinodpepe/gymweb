import type { WorkoutSet } from "../schemas/workout";
import { benjaminiHochberg, bestLag, MIN_PAIRS, relate, type Relation } from "../stats/correlation";
import { ewmaIrregular, type DatedValue } from "../stats/ewma";
import { paceSecPerKm, summarizeRuns } from "../stats/pace";
import { olsFit } from "../stats/regression";
import { calibrateScales, type WeighIn } from "../stats/scaleCalibration";
import { theilSen, theilSenSlope } from "../stats/theilSen";
import { mean, median } from "../stats/util";
import { addDays, dayNumber, daysBetween, isoWeekStart } from "../stats/weeks";
import { WEIGHT_ALPHA } from "../stats/bodyTrend";
import {
  exerciseSeries,
  groupDays,
  type InsightData,
  LEG_GROUPS,
  valueAt,
  weekEnd,
  weeklyKm,
  weeklyStepsMean,
  weeklyWeightChange,
  lastCompleteWeek,
  weekRange,
} from "./data";

/** A scatter-plot relation between two variables. */
export interface ScatterCross {
  id: string;
  title: string;
  question: string;
  xLabel: string;
  yLabel: string;
  xUnit: string;
  yUnit: string;
  points: { x: number; y: number; label: string }[];
  relation: Relation;
  /** Lag in weeks used (y after x) and how many were tried. */
  lag: { weeks: number; tried: number } | null;
  /** Survives Benjamini–Hochberg across all the scatter relations (false while there is no coefficient). */
  survives: boolean;
  caveat: string;
}

const scatter = (
  meta: Omit<ScatterCross, "points" | "relation" | "lag" | "survives">,
  points: ScatterCross["points"],
  lag: ScatterCross["lag"] = null,
  relation?: Relation,
): ScatterCross => ({
  ...meta,
  points,
  lag,
  relation: relation ?? relate(points.map((p) => p.x), points.map((p) => p.y)),
  survives: false,
});

/** Marks which relations survive the false-discovery correction. */
export function applyFdr<T extends { relation: Relation; survives: boolean }>(crosses: T[]): T[] {
  const keep = benjaminiHochberg(crosses.map((c) => c.relation.p));
  return crosses.map((c, i) => ({ ...c, survives: keep[i] }));
}

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

// ---------------------------------------------------------------- weight ↔ running / steps

export function crossKmWeight(d: InsightData): ScatterCross {
  const km = weeklyKm(d.runs, d.today);
  const change = new Map(weeklyWeightChange(d.weights, d.today).map((w) => [w.week_start, w.change_kg]));
  const scan = bestLag(km, change, [0, 1, 2]);
  return scatter(
    {
      id: "km-peso",
      title: "Kilómetros y cambio de peso",
      question: "¿El peso baja más las semanas que corro más?",
      xLabel: "Km en la semana",
      yLabel: "Cambio del peso (EWMA)",
      xUnit: "km",
      yUnit: "kg",
      caveat: "El peso depende sobre todo de la ingesta, que aquí no se registra: la relación puede ser indirecta.",
    },
    scan.pairs.map((p) => ({ x: round(p.x, 1), y: round(p.y), label: `Semana del ${p.week}` })),
    { weeks: scan.lag, tried: scan.tried },
    scan.relation,
  );
}

export function crossStepsWeight(d: InsightData): ScatterCross {
  const steps = weeklyStepsMean(d.steps, d.today);
  const change = new Map(weeklyWeightChange(d.weights, d.today).map((w) => [w.week_start, w.change_kg]));
  const scan = bestLag(steps, change, [0, 1]);
  return scatter(
    {
      id: "pasos-peso",
      title: "Pasos y cambio de peso",
      question: "¿Más pasos, menos peso?",
      xLabel: "Pasos diarios (media de la semana)",
      yLabel: "Cambio del peso (EWMA)",
      xUnit: "pasos",
      yUnit: "kg",
      caveat: "Solo semanas con al menos 4 días de pasos. La media semanal oculta días sueltos muy distintos.",
    },
    scan.pairs.map((p) => ({ x: Math.round(p.x), y: round(p.y), label: `Semana del ${p.week}` })),
    { weeks: scan.lag, tried: scan.tried },
    scan.relation,
  );
}

// ---------------------------------------------------------------- legs and weight (box by volume level)

export interface LevelBox {
  level: string;
  n: number;
  median: number | null;
}

export interface LegsWeightBox {
  id: "piernas-peso";
  title: string;
  question: string;
  caveat: string;
  levels: LevelBox[];
  /** Weigh-ins used. */
  n: number;
  enough: boolean;
}

const LEG_LEVELS: { level: string; test: (n: number) => boolean }[] = [
  { level: "0 series", test: (n) => n === 0 },
  { level: "1–5 series", test: (n) => n >= 1 && n <= 5 },
  { level: "6–11 series", test: (n) => n >= 6 && n <= 11 },
  { level: "12 o más", test: (n) => n >= 12 },
];

export function legsWeightBox(d: InsightData): LegsWeightBox {
  const weights = [...d.weights].sort((a, b) => a.date.localeCompare(b.date));
  const ewma = ewmaIrregular(weights, WEIGHT_ALPHA, 1);
  const days = groupDays(d.sessions);
  const legSets = (day: string) =>
    LEG_GROUPS.reduce((t, g) => t + (days.get(g)?.get(addDays(day, -1)) ?? 0) + (days.get(g)?.get(addDays(day, -2)) ?? 0), 0);

  const bins = LEG_LEVELS.map((l) => ({ ...l, resid: [] as number[] }));
  weights.forEach((w, i) => {
    // The day's weight against the EWMA built before it: the day itself must not pull its own reference.
    const prev = i > 0 ? ewma[i - 1] : null;
    if (!prev || daysBetween(prev.date, w.date) > 7) return;
    const n = legSets(w.date);
    bins.find((b) => b.test(n))?.resid.push(w.value - prev.value);
  });
  const total = bins.reduce((t, b) => t + b.resid.length, 0);
  return {
    id: "piernas-peso",
    title: "Peso tras entrenar piernas",
    question: "¿Mi peso sube los días tras entrenar piernas?",
    caveat:
      "Diferencia entre el peso del día y la tendencia anterior, según las series de piernas de los 2 días previos. Solo orientativo: la retención de líquidos, la sal y la hidratación también mueven el peso del día.",
    levels: bins.map((b) => ({ level: b.level, n: b.resid.length, median: b.resid.length ? round(median(b.resid)) : null })),
    n: total,
    enough: total >= MIN_PAIRS && bins.filter((b) => b.resid.length >= 5).length >= 2,
  };
}

// ---------------------------------------------------------------- scale drift

export interface ScaleDrift {
  scale: string;
  now: number;
  before: number;
  change: number;
  drifting: boolean;
}

/** Compares each scale's bias now with the one 90 days ago; flags it when the change is larger than the noise. */
export function scaleDrift(weighIns: readonly WeighIn[], today: string): ScaleDrift[] {
  const now = calibrateScales(weighIns, today).scales;
  const before = calibrateScales(weighIns, addDays(today, -90)).scales;
  return now.flatMap((n) => {
    const b = before.find((x) => x.scale === n.scale);
    if (!b || n.offset === null || b.offset === null) return [];
    const change = n.offset - b.offset;
    const noise = (n.ci95 ?? 0) + (b.ci95 ?? 0);
    return [{ scale: n.scale, now: round(n.offset), before: round(b.offset), change: round(change), drifting: Math.abs(change) > Math.max(0.3, noise) }];
  });
}

// ---------------------------------------------------------------- relative strength

export interface RelativeStrength {
  exercise: string;
  sessions: number;
  /** e1RM / body weight, one value per training day. */
  points: DatedValue[];
  first: number;
  last: number;
  change_pct: number;
}

/** e1RM divided by the EWMA body weight, for the exercises with enough sessions. */
export function relativeStrength(d: InsightData, { maxExercises = 6, minSessions = 4 } = {}): RelativeStrength[] {
  const weights = ewmaIrregular([...d.weights].sort((a, b) => a.date.localeCompare(b.date)), WEIGHT_ALPHA, 1);
  return exerciseSeries(d.sessions)
    .flatMap((s) => {
      const points = s.points.flatMap((p) => {
        const w = valueAt(weights, p.date.slice(0, 10), 14);
        return w ? [{ date: p.date, value: round(p.value / w, 3) }] : [];
      });
      if (points.length < minSessions) return [];
      const first = points[0].value;
      const last = points[points.length - 1].value;
      return [{ exercise: s.exercise, sessions: points.length, points, first, last, change_pct: round(((last / first) - 1) * 100, 1) }];
    })
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, maxExercises);
}

// ---------------------------------------------------------------- strength windows: frequency and volume vs progress

export const WINDOW_WEEKS = 4;
const MAX_WINDOWS = 6;

export interface StrengthWindow {
  exercise: string;
  group: string;
  window_start: string;
  /** Mean training days per week of the exercise's muscle group in the window. */
  frequency: number;
  /** Mean direct working sets per week of the group in the window. */
  sets: number;
  /** Change of the e1RM trend in the window, % per week. */
  gain_pct_week: number;
}

/** Non-overlapping 4-week windows per exercise, ending at the last complete week. */
export function strengthWindows(d: InsightData): StrengthWindow[] {
  const last = weekEnd(lastCompleteWeek(d.today));
  const days = groupDays(d.sessions);
  const out: StrengthWindow[] = [];
  for (const s of exerciseSeries(d.sessions)) {
    if (!s.muscle_group || s.points.length < 3) continue;
    const g = days.get(s.muscle_group);
    for (let k = 0; k < MAX_WINDOWS; k++) {
      const end = addDays(last, -7 * WINDOW_WEEKS * k);
      const start = addDays(end, -7 * WINDOW_WEEKS + 1);
      if (!s.points.some((p) => p.date >= start && p.date <= end)) continue;
      const before = valueAt(s.ewma, addDays(start, -1), 21);
      const after = valueAt(s.ewma, end, 21);
      if (!before || !after) continue;
      const inWindow = g ? [...g].filter(([day]) => day >= start && day <= end) : [];
      out.push({
        exercise: s.exercise,
        group: s.muscle_group,
        window_start: start,
        frequency: round(inWindow.length / WINDOW_WEEKS, 2),
        sets: round(inWindow.reduce((t, [, n]) => t + n, 0) / WINDOW_WEEKS, 1),
        gain_pct_week: round(((after / before - 1) * 100) / WINDOW_WEEKS, 2),
      });
    }
  }
  return out;
}

export function crossFrequencyProgress(windows: readonly StrengthWindow[]): ScatterCross {
  return scatter(
    {
      id: "frecuencia-progreso",
      title: "Frecuencia y progreso",
      question: "¿Subo más cuando entreno un músculo más veces por semana?",
      xLabel: "Días por semana del músculo",
      yLabel: "Cambio del e1RM",
      xUnit: "días/sem",
      yUnit: "%/sem",
      caveat: "Cada punto es un ejercicio en una ventana de 4 semanas. Los ejercicios nuevos progresan más rápido: no mezcla con «efecto».",
    },
    windows.map((w) => ({ x: w.frequency, y: w.gain_pct_week, label: `${w.exercise} · desde ${w.window_start}` })),
  );
}

export function crossVolumeProgress(windows: readonly StrengthWindow[]): ScatterCross {
  return scatter(
    {
      id: "volumen-progreso",
      title: "Volumen y progreso",
      question: "¿Más volumen = más progreso, o hay un tope?",
      xLabel: "Series directas por semana del músculo",
      yLabel: "Cambio del e1RM",
      xUnit: "series/sem",
      yUnit: "%/sem",
      caveat: "Cada punto es un ejercicio en una ventana de 4 semanas. Mira la tabla por tramos: si la mediana se aplana, hay un tope.",
    },
    windows.map((w) => ({ x: w.sets, y: w.gain_pct_week, label: `${w.exercise} · desde ${w.window_start}` })),
  );
}

export interface VolumeBin {
  label: string;
  n: number;
  median_gain: number | null;
}

const VOLUME_BINS: { label: string; test: (n: number) => boolean }[] = [
  { label: "0–5", test: (n) => n < 6 },
  { label: "6–10", test: (n) => n >= 6 && n < 11 },
  { label: "11–15", test: (n) => n >= 11 && n < 16 },
  { label: "16–20", test: (n) => n >= 16 && n < 21 },
  { label: "21+", test: (n) => n >= 21 },
];

/** Median progress per weekly-volume bracket: where the curve flattens. */
export function volumeBins(windows: readonly StrengthWindow[]): VolumeBin[] {
  return VOLUME_BINS.map((b) => {
    const ys = windows.filter((w) => b.test(w.sets)).map((w) => w.gain_pct_week);
    return { label: b.label, n: ys.length, median_gain: ys.length ? round(median(ys)) : null };
  });
}

// ---------------------------------------------------------------- rest and position inside the session

export function crossRestSession(d: InsightData): ScatterCross {
  const days = groupDays(d.sessions);
  const points: ScatterCross["points"] = [];
  for (const s of exerciseSeries(d.sessions)) {
    if (!s.muscle_group) continue;
    const trained = [...(days.get(s.muscle_group)?.keys() ?? [])].sort();
    s.points.forEach((p, i) => {
      if (i < 3) return;
      const prevTrained = [...trained].reverse().find((x) => x < p.date);
      const reference = s.ewma[i - 1].value;
      if (!prevTrained || reference <= 0) return;
      points.push({
        x: Math.min(14, Math.round(daysBetween(prevTrained, p.date))),
        y: round((p.value / reference - 1) * 100, 1),
        label: `${s.exercise} · ${p.date}`,
      });
    });
  }
  return scatter(
    {
      id: "descanso-sesion",
      title: "Descanso y rendimiento",
      question: "¿Descansar entre sesiones ayuda?",
      xLabel: "Días desde el último trabajo del músculo",
      yLabel: "e1RM frente a la tendencia previa",
      xUnit: "días",
      yUnit: "%",
      caveat: "Descansos de más de 14 días se agrupan en 14. No se sabe cuánto dormiste ni cómo estabas de energía.",
    },
    points,
  );
}

export interface PositionBucket {
  label: string;
  n: number;
  /** Mean e1RM of the entry relative to the exercise's own mean (100 = its usual level). */
  mean_pct: number | null;
}

export interface PositionAnalysis {
  id: "posicion";
  title: string;
  question: string;
  caveat: string;
  buckets: PositionBucket[];
  n: number;
  enough: boolean;
}

const POSITION_BUCKETS = ["1.º", "2.º", "3.º", "4.º o más"];

/** e1RM of each exercise relative to its own mean, by position in the session (controls for the exercise). */
export function positionAnalysis(d: InsightData, { minSessions = 4 } = {}): PositionAnalysis {
  const ratios: number[][] = POSITION_BUCKETS.map(() => []);
  const entries = new Map<string, { value: number; position: number }[]>();
  const perDay = new Map<string, { day: string; position: number; sets: WorkoutSet[] }>();
  for (const s of d.sessions) {
    const key = `${s.exercise}|${s.date.slice(0, 10)}`;
    const cur = perDay.get(key);
    if (cur) {
      cur.position = Math.min(cur.position, s.position);
      cur.sets.push(...s.sets);
    } else perDay.set(key, { day: s.date.slice(0, 10), position: s.position, sets: [...s.sets] });
  }
  const series = new Map(exerciseSeries(d.sessions).map((s) => [s.exercise, s]));
  for (const [key, e] of perDay) {
    const name = key.slice(0, key.lastIndexOf("|"));
    const point = series.get(name)?.points.find((p) => p.date === e.day);
    if (!point) continue;
    entries.set(name, [...(entries.get(name) ?? []), { value: point.value, position: e.position }]);
  }
  for (const list of entries.values()) {
    if (list.length < minSessions) continue;
    const m = mean(list.map((x) => x.value));
    for (const x of list) ratios[Math.min(3, x.position)].push((x.value / m) * 100);
  }
  const n = ratios.reduce((t, r) => t + r.length, 0);
  return {
    id: "posicion",
    title: "Posición en el entreno",
    question: "¿Rindo menos en los últimos ejercicios del entreno?",
    caveat:
      "Cada ejercicio se compara con su propia media. La posición no es el tiempo transcurrido: se usa el orden del ejercicio como aproximación a la 1.ª o 2.ª hora.",
    buckets: POSITION_BUCKETS.map((label, i) => ({ label, n: ratios[i].length, mean_pct: ratios[i].length ? round(mean(ratios[i]), 1) : null })),
    n,
    enough: n >= MIN_PAIRS,
  };
}

// ---------------------------------------------------------------- running ↔ legs strength and pace ↔ weight

/** % change of the leg e1RM trend between the end of week w and two weeks later (needs new sessions in between). */
function legChangeByWeek(d: InsightData): Map<string, number> {
  const legs = exerciseSeries(d.sessions).filter((s) => s.muscle_group && LEG_GROUPS.includes(s.muscle_group) && s.points.length >= 3);
  const first = d.sessions.map((s) => s.date.slice(0, 10)).sort()[0];
  const out = new Map<string, number>();
  if (!first) return out;
  for (const w of weekRange(first, addDays(lastCompleteWeek(d.today), -14))) {
    const changes: number[] = [];
    for (const s of legs) {
      const a = valueAt(s.ewma, weekEnd(w), 28);
      const b = valueAt(s.ewma, weekEnd(addDays(w, 14)), 28);
      const fresh = s.points.some((p) => p.date > weekEnd(w) && p.date <= weekEnd(addDays(w, 14)));
      if (a && b && fresh) changes.push((b / a - 1) * 100);
    }
    if (changes.length) out.set(w, mean(changes));
  }
  return out;
}

export function crossRunLegs(d: InsightData): ScatterCross {
  const scan = bestLag(weeklyKm(d.runs, d.today), legChangeByWeek(d), [0]);
  return scatter(
    {
      id: "carrera-piernas",
      title: "Carrera y fuerza de piernas",
      question: "¿Correr interfiere con la fuerza de las piernas?",
      xLabel: "Km en la semana",
      yLabel: "Cambio del e1RM de piernas en las 2 semanas siguientes",
      xUnit: "km",
      yUnit: "%",
      caveat: "Hay confusores: las fases de volumen o definición cambian a la vez la carrera y la fuerza.",
    },
    scan.pairs.map((p) => ({ x: round(p.x, 1), y: round(p.y, 1), label: `Semana del ${p.week}` })),
    { weeks: scan.lag, tried: scan.tried },
    scan.relation,
  );
}

/** Runs of one surface within ±20 % of that surface's median distance. */
export function comparableRuns(runs: InsightData["runs"], surface: "outdoor" | "treadmill") {
  const list = runs.filter((r) => r.surface === surface);
  if (!list.length) return [];
  const ref = median(list.map((r) => r.distance_km));
  return list.filter((r) => Math.abs(r.distance_km - ref) <= 0.2 * ref);
}

export interface PaceWeight {
  surface: "outdoor" | "treadmill";
  cross: ScatterCross;
  /** Seconds per km gained per kg lost (Theil-Sen, null while there is no coefficient). */
  sec_per_kg: { slope: number; ci95: [number, number] } | null;
}

/** Pace of comparable runs against the EWMA weight of that day. */
export function paceVsWeight(d: InsightData): PaceWeight[] {
  const weights = ewmaIrregular([...d.weights].sort((a, b) => a.date.localeCompare(b.date)), WEIGHT_ALPHA, 1);
  return (["outdoor", "treadmill"] as const).map((surface) => {
    const pairs = comparableRuns(d.runs, surface).flatMap((r) => {
      const w = valueAt(weights, r.date, 7);
      return w ? [{ x: round(w, 1), y: Math.round(paceSecPerKm(r)), label: `${r.date} · ${round(r.distance_km, 1)} km` }] : [];
    });
    const cross = scatter(
      {
        id: `ritmo-peso-${surface}`,
        title: `Ritmo y peso (${surface === "outdoor" ? "exterior" : "cinta"})`,
        question: "Cada kg menos, ¿cuántos segundos por km?",
        xLabel: "Peso (EWMA) del día",
        yLabel: "Ritmo",
        xUnit: "kg",
        yUnit: "s/km",
        caveat: "Solo rodajes comparables (misma superficie, distancia ±20 % de la mediana). Mejorar con el tiempo también mejora el ritmo sin que cambie el peso.",
      },
      pairs,
    );
    const fit = cross.relation.enough
      ? theilSen(pairs.map((p) => p.x), pairs.map((p) => p.y))
      : null;
    return { surface, cross, sec_per_kg: fit ? { slope: round(fit.slope, 1), ci95: [round(fit.ci95[0], 1), round(fit.ci95[1], 1)] as [number, number] } : null };
  });
}

// ---------------------------------------------------------------- weight vs strength quadrants

export type Quadrant = "ambos_suben" | "peso_sube_fuerza_no" | "fuerza_sube_peso_no" | "ninguno_sube";

export interface QuadrantWindow {
  start: string;
  end: string;
  /** kg per week (OLS on the EWMA weight). */
  weight_slope: number;
  /** % per week of the median exercise (Theil-Sen on e1RM). */
  strength_slope: number;
  quadrant: Quadrant;
}

export const QUADRANT_WEEKS = 8;
const WEIGHT_DEADBAND = 0.1; // kg/week
const STRENGTH_DEADBAND = 0.1; // %/week

export function quadrantOf(weight: number, strength: number): Quadrant {
  const w = weight > WEIGHT_DEADBAND;
  const s = strength > STRENGTH_DEADBAND;
  return w && s ? "ambos_suben" : w ? "peso_sube_fuerza_no" : s ? "fuerza_sube_peso_no" : "ninguno_sube";
}

/** 8-week windows sliding by 2 weeks: is weight going up, and is strength? */
export function weightStrengthQuadrants(d: InsightData): QuadrantWindow[] {
  const weights = ewmaIrregular([...d.weights].sort((a, b) => a.date.localeCompare(b.date)), WEIGHT_ALPHA, 1);
  const series = exerciseSeries(d.sessions);
  const out: QuadrantWindow[] = [];
  const last = weekEnd(lastCompleteWeek(d.today));
  for (let k = 0; k < 12; k++) {
    const end = addDays(last, -14 * k);
    const start = addDays(end, -7 * QUADRANT_WEEKS + 1);
    const w = weights.filter((p) => p.date >= start && p.date <= end);
    if (w.length < 8) continue;
    const wFit = olsFit(w.map((p) => dayNumber(p.date) / 7), w.map((p) => p.value));
    const slopes: number[] = [];
    for (const s of series) {
      const pts = s.points.filter((p) => p.date >= start && p.date <= end);
      if (pts.length < 3) continue;
      const slope = theilSenSlope(pts.map((p) => dayNumber(p.date) / 7), pts.map((p) => p.value));
      if (Number.isFinite(slope)) slopes.push((slope / mean(pts.map((p) => p.value))) * 100);
    }
    if (!wFit || slopes.length < 2) continue;
    const strength = median(slopes);
    out.push({ start, end, weight_slope: round(wFit.slope), strength_slope: round(strength), quadrant: quadrantOf(wFit.slope, strength) });
  }
  return out.reverse();
}

// ---------------------------------------------------------------- adherence

export interface RoutineAdherence {
  routine: string;
  /** Weeks (of the last `weeks`) with at least one session of this routine. */
  weeks_done: number;
  weeks: number;
  /** Sessions per weekday, Monday first. */
  weekdays: number[];
  usual_weekday: number;
  last_date: string;
  /** Done in fewer than half of the weeks (judged only with at least 4 weeks of history). */
  often_missed: boolean;
}

export const ADHERENCE_WEEKS = 12;

/** Which routines get done, when, and which ones keep dropping out. */
export function routineAdherence(d: InsightData): RoutineAdherence[] {
  const since = addDays(isoWeekStart(d.today), -7 * (ADHERENCE_WEEKS - 1));
  const firstDay = d.sessions.map((s) => s.date.slice(0, 10)).sort()[0];
  const weeksAvailable = firstDay
    ? Math.min(ADHERENCE_WEEKS, Math.round((dayNumber(isoWeekStart(d.today)) - dayNumber(isoWeekStart(firstDay))) / 7) + 1)
    : ADHERENCE_WEEKS;
  const byRoutine = new Map<string, Set<string>>();
  for (const s of d.sessions) byRoutine.set(s.routine, (byRoutine.get(s.routine) ?? new Set()).add(s.date.slice(0, 10)));
  const out: RoutineAdherence[] = [];
  for (const [routine, daysSet] of byRoutine) {
    const days = [...daysSet].sort();
    const recent = days.filter((x) => x >= since);
    if (!recent.length) continue;
    const weekdays = Array.from({ length: 7 }, () => 0);
    for (const x of recent) weekdays[(new Date(`${x}T00:00:00Z`).getUTCDay() + 6) % 7]++;
    const weeksDone = new Set(recent.map(isoWeekStart)).size;
    out.push({
      routine,
      weeks_done: weeksDone,
      weeks: weeksAvailable,
      weekdays,
      usual_weekday: weekdays.indexOf(Math.max(...weekdays)),
      last_date: days[days.length - 1],
      often_missed: weeksAvailable >= 4 && weeksDone < weeksAvailable / 2,
    });
  }
  return out.sort((a, b) => b.weeks_done - a.weeks_done || a.routine.localeCompare(b.routine));
}

// ---------------------------------------------------------------- treadmill vs outdoor at the same effort

export interface EffortBand {
  band: string;
  outdoor: { n: number; pace: number | null };
  treadmill: { n: number; pace: number | null };
  /** Treadmill pace minus outdoor pace in s/km (negative = faster on the treadmill); needs ≥ 2 runs on each. */
  diff_s: number | null;
}

const EFFORT_BANDS: { band: string; test: (e: number) => boolean }[] = [
  { band: "Fácil (1–4)", test: (e) => e <= 4 },
  { band: "Moderado (5–6)", test: (e) => e >= 5 && e <= 6 },
  { band: "Duro (7–10)", test: (e) => e >= 7 },
];

/** Weighted pace per surface within each perceived-effort band; only runs with a recorded effort count. */
export function surfaceAtEffort(runs: InsightData["runs"]): EffortBand[] {
  const cell = (list: InsightData["runs"]) => ({ n: list.length, pace: summarizeRuns(list).pace_s_per_km });
  return EFFORT_BANDS.map(({ band, test }) => {
    const inBand = runs.filter((r) => r.effort !== null && r.effort !== undefined && test(r.effort));
    const outdoor = cell(inBand.filter((r) => r.surface === "outdoor"));
    const treadmill = cell(inBand.filter((r) => r.surface === "treadmill"));
    const diff = outdoor.n >= 2 && treadmill.n >= 2 && outdoor.pace !== null && treadmill.pace !== null ? Math.round(treadmill.pace - outdoor.pace) : null;
    return { band, outdoor, treadmill, diff_s: diff };
  });
}
