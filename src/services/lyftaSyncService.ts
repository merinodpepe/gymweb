import "server-only";
import { type ApiSummary, type ApiWorkout, mapApiWorkout } from "@/domain/lyfta/mapApi";
import { APP_TIME_ZONE } from "@/domain/stats/weeks";
import { exerciseAliasRepo } from "@/repositories/exerciseAliasRepo";
import { workoutRepo } from "@/repositories/workoutRepo";
import { fillMissingMuscleGroups } from "@/services/muscleService";

const BASE_URL = "https://my.lyfta.app/api/v1";
const PAGE_SIZE = 100;
const DEFAULT_WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;

export class LyftaApiError extends Error {}

export interface SyncResult {
  created: number;
  skipped: number;
  warnings: string[];
}

async function lyftaGet<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const key = process.env.LYFTA_API_KEY?.trim();
  if (!key) throw new LyftaApiError("Falta la variable LYFTA_API_KEY (ver SETUP.md).");
  const url = `${BASE_URL}${path}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
  if (res.status === 401 || res.status === 403) throw new LyftaApiError("Lyfta rechazó la API key: genera una nueva.");
  if (res.status === 429) throw new LyftaApiError("Límite de la API de Lyfta alcanzado; reinténtalo más tarde.");
  if (!res.ok) throw new LyftaApiError(`La API de Lyfta respondió ${res.status}.`);
  return (await res.json()) as T;
}

/**
 * Pulls workouts from the Lyfta API and stores the ones not saved yet.
 * Idempotent: a workout already stored (same date and routine, e.g. imported from text) is skipped.
 * `full` re-reads the whole history instead of the last two weeks.
 */
export async function syncFromLyfta({ full = false }: { full?: boolean } = {}): Promise<SyncResult> {
  const from = new Date(Date.now() - DEFAULT_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10);
  const workouts: ApiWorkout[] = [];
  for (let page = 1; ; page++) {
    const body = await lyftaGet<{ workouts?: ApiWorkout[]; total_pages?: number }>("/workouts", {
      limit: PAGE_SIZE,
      page,
      ...(!full && { from }),
    });
    workouts.push(...(body.workouts ?? []));
    if (page >= (body.total_pages ?? 1)) break;
  }
  if (!workouts.length) return { created: 0, skipped: 0, warnings: [] };

  const summaries = new Map<string, ApiSummary>();
  const sum = await lyftaGet<{ workouts?: ApiSummary[] }>("/workouts/summary", { limit: 1000 });
  for (const s of sum.workouts ?? []) summaries.set(String(s.id), s);

  const [aliases, dumbbells] = await Promise.all([exerciseAliasRepo.map(), exerciseAliasRepo.dumbbells()]);
  const canonical = (name: string) => aliases.get(name)?.canonical_name ?? name;

  const result: SyncResult = { created: 0, skipped: 0, warnings: [] };
  const names: string[] = [];
  // Oldest first, so a failure midway leaves no gap before the newest stored workout.
  for (const api of workouts.sort((a, b) => a.workout_perform_date.localeCompare(b.workout_perform_date))) {
    const { workout, warnings } = mapApiWorkout(api, summaries.get(String(api.id)), {
      timeZone: APP_TIME_ZONE,
      dumbbells,
    });
    if (!workout.routine_name || !workout.exercises.length) continue;
    if (await workoutRepo.findByKey(workout.date, workout.routine_name)) {
      result.skipped++;
      continue;
    }
    await workoutRepo.save(workout, canonical, warnings);
    result.created++;
    result.warnings.push(...warnings.map((w) => `${workout.routine_name}: ${w}`));
    names.push(...workout.exercises.map((e) => e.name));
  }
  if (names.length) await fillMissingMuscleGroups(names);
  return result;
}
