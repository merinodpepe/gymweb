import type { WorkoutSet } from "../schemas/workout";
import { MUSCLE_GROUPS } from "../muscles/matchMuscle";
import { addDays, isoWeekStart } from "../stats/weeks";
import { classify, rangeFor, type SetRange, type VolumeStatus } from "./volumeTargets";

/** Fraction of a set credited to a muscle that is only a secondary mover. */
export const INDIRECT_WEIGHT = 0.5;
/** Current (partial) week plus this many complete weeks before it. */
export const PREVIOUS_WEEKS = 3;

export interface CoachSession {
  /** `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`. */
  date: string;
  muscle_group: string | null;
  /** Other groups this exercise also works (credited at INDIRECT_WEIGHT). */
  secondary: readonly string[];
  sets: readonly WorkoutSet[];
}

export interface GroupWeek {
  week_start: string;
  partial: boolean;
  direct: number;
  total: number;
}

export interface GroupReport {
  group: string;
  range: SetRange;
  /** Oldest → current week. */
  weeks: GroupWeek[];
  current: GroupWeek;
  /** Sets still missing this week to reach the bottom of the range. */
  current_deficit: number;
  /** Mean total sets over the complete weeks (the number the status is based on). */
  average: number;
  /** Mean number of sessions per week with direct work for this group. */
  frequency: number;
  status: VolumeStatus;
  /** Sets per week missing to reach the bottom of the range (0 if there). */
  deficit: number;
  advice: string;
}

export interface CoachReport {
  week_starts: string[];
  /** Least trained first. */
  groups: GroupReport[];
  /** Working sets in the window whose exercise has no muscle group. */
  unassigned_sets: number;
  has_data: boolean;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const workingSets = (sets: readonly WorkoutSet[]) => sets.filter((s) => !s.is_warmup).length;

function adviceFor(group: string, status: VolumeStatus, average: number, deficit: number, frequency: number, range: SetRange) {
  if (status === "muy_bajo" || status === "bajo") {
    const missing = Math.ceil(deficit);
    const none = average === 0 ? `No has entrenado ${group} en las últimas semanas. ` : "";
    return `${none}Te faltan ~${missing} series/semana para llegar a ${range.min}. Añade ${Math.max(1, Math.ceil(missing / 3))}–${Math.max(2, Math.ceil(missing / 2))} ejercicios directos.`;
  }
  if (status === "alto") return `Estás por encima de ${range.max} series/semana: más no suele rendir más; valora recortar o mover series a un músculo flojo.`;
  if (frequency > 0 && frequency < 2) return "Buen volumen, pero solo lo trabajas ~1 día/semana: repartirlo en 2 sesiones suele rendir más.";
  return "En zona objetivo. Mantén y busca progresar en carga o repeticiones.";
}

/**
 * Effective (working) sets per muscle group for the current week and the previous four.
 * Indirect work counts as INDIRECT_WEIGHT of a set. Groups with no sets still appear, with 0.
 */
export function weeklyCoach(items: readonly CoachSession[], today: string): CoachReport {
  const current = isoWeekStart(today);
  const starts = Array.from({ length: PREVIOUS_WEEKS + 1 }, (_, i) => addDays(current, -7 * (PREVIOUS_WEEKS - i)));
  const index = new Map(starts.map((s, i) => [s, i]));

  const direct = new Map<string, number[]>();
  const indirect = new Map<string, number[]>();
  const days = new Map<string, Set<string>[]>();
  const cell = (m: Map<string, number[]>, g: string) => {
    let a = m.get(g);
    if (!a) m.set(g, (a = starts.map(() => 0)));
    return a;
  };
  let unassigned = 0;
  let any = false;

  for (const it of items) {
    const w = index.get(isoWeekStart(it.date));
    if (w === undefined) continue;
    const n = workingSets(it.sets);
    if (!n) continue;
    any = true;
    if (it.muscle_group) {
      cell(direct, it.muscle_group)[w] += n;
      const d = days.get(it.muscle_group) ?? starts.map(() => new Set<string>());
      d[w].add(it.date.slice(0, 10));
      days.set(it.muscle_group, d);
    } else {
      unassigned += n;
    }
    for (const g of it.secondary) if (g !== it.muscle_group) cell(indirect, g)[w] += n * INDIRECT_WEIGHT;
  }

  const names = [...new Set([...MUSCLE_GROUPS, ...direct.keys(), ...indirect.keys()])];
  const groups: GroupReport[] = names.map((group) => {
    const d = direct.get(group) ?? starts.map(() => 0);
    const i = indirect.get(group) ?? starts.map(() => 0);
    const weeks: GroupWeek[] = starts.map((week_start, k) => ({
      week_start,
      partial: week_start === current,
      direct: d[k],
      total: round1(d[k] + i[k]),
    }));
    const complete = weeks.filter((w) => !w.partial);
    const average = round1(mean(complete.map((w) => w.total)));
    const frequency = round1(mean(complete.map((_, k) => days.get(group)?.[k].size ?? 0)));
    const range = rangeFor(group);
    const status = classify(average, range);
    const deficit = round1(Math.max(0, range.min - average));
    return {
      group,
      range,
      weeks,
      current: weeks[weeks.length - 1],
      current_deficit: round1(Math.max(0, range.min - weeks[weeks.length - 1].total)),
      average,
      frequency,
      status,
      deficit,
      advice: adviceFor(group, status, average, deficit, frequency, range),
    };
  });
  groups.sort((a, b) => a.average - b.average || a.group.localeCompare(b.group));
  return { week_starts: starts, groups, unassigned_sets: unassigned, has_data: any };
}
