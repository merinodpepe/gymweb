import "server-only";
import { sessionE1rm } from "@/domain/stats/e1rm";
import { computePrs } from "@/domain/stats/prs";
import { strengthTrend } from "@/domain/stats/strengthTrend";
import { acuteChronicRatio, weeklyVolume } from "@/domain/stats/volume";
import { addDays, todayIso } from "@/domain/stats/weeks";
import { exerciseAliasRepo } from "@/repositories/exerciseAliasRepo";
import { workoutRepo, type ExerciseHistoryRow } from "@/repositories/workoutRepo";

/** Merge several entries of the same exercise within one workout into one session. */
function bySession(rows: ExerciseHistoryRow[]) {
  const map = new Map<string, ExerciseHistoryRow>();
  for (const r of rows) {
    const prev = map.get(r.date);
    if (prev) prev.sets = [...prev.sets, ...r.sets];
    else map.set(r.date, { ...r, sets: [...r.sets] });
  }
  return [...map.values()];
}

export async function getExerciseProgress(canonicalName: string) {
  const sessions = bySession(await workoutRepo.exerciseHistory(canonicalName));
  const points = sessions
    .map((s) => ({ date: s.date.slice(0, 10), value: sessionE1rm(s.sets) }))
    .filter((p): p is { date: string; value: number } => p.value !== null);
  const trend = strengthTrend(points);
  const prs = computePrs(sessions.map((s) => ({ date: s.date.slice(0, 10), sets: s.sets })));
  return {
    exercise: canonicalName,
    sessions: sessions.map((s) => ({ date: s.date, sets: s.sets, e1rm: sessionE1rm(s.sets) })),
    trend,
    prs,
  };
}

export type ExerciseProgress = Awaited<ReturnType<typeof getExerciseProgress>>;

export async function getExerciseOverview() {
  const [rows, aliases] = await Promise.all([workoutRepo.exerciseHistory(), exerciseAliasRepo.map()]);
  const groups = new Map<string, ExerciseHistoryRow[]>();
  for (const r of rows) groups.set(r.canonical_name, [...(groups.get(r.canonical_name) ?? []), r]);

  const muscleOf = (canonical: string) =>
    [...aliases.values()].find((a) => a.canonical_name === canonical && a.muscle_group)?.muscle_group ?? null;

  const exercises = [...groups.entries()].map(([name, list]) => {
    const sessions = bySession(list);
    const points = sessions
      .map((s) => ({ date: s.date.slice(0, 10), value: sessionE1rm(s.sets) }))
      .filter((p): p is { date: string; value: number } => p.value !== null);
    const trend = strengthTrend(points);
    return {
      name,
      muscle_group: muscleOf(name),
      sessions: sessions.length,
      last_date: sessions.at(-1)?.date ?? null,
      last_e1rm: points.at(-1)?.value ?? null,
      slope: trend.theilSen?.slope ?? null,
      label: trend.label,
    };
  });
  exercises.sort((a, b) => (b.last_date ?? "").localeCompare(a.last_date ?? ""));

  const today = todayIso();
  const items = rows.map((r) => ({ date: r.date, muscle_group: muscleOf(r.canonical_name), sets: r.sets }));
  const recent = items.filter((i) => i.date.slice(0, 10) >= addDays(today, -7 * 12));
  return {
    exercises,
    weekly: weeklyVolume(recent, today),
    acwr: acuteChronicRatio(items, today),
  };
}
