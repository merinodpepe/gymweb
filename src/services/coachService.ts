import "server-only";
import dataset from "@/data/exercises.json";
import { type CoachSession, weeklyCoach } from "@/domain/coach/weeklyCoach";
import { type DatasetRow, matchMuscle } from "@/domain/muscles/matchMuscle";
import { addDays, todayIso } from "@/domain/stats/weeks";
import { exerciseAliasRepo } from "@/repositories/exerciseAliasRepo";
import { workoutRepo } from "@/repositories/workoutRepo";

const rows = dataset as unknown as DatasetRow[];

export async function getCoachReport() {
  const [history, aliases] = await Promise.all([workoutRepo.exerciseHistory(), exerciseAliasRepo.list()]);
  const groupOf = new Map<string, string>();
  for (const a of aliases) if (a.muscle_group) groupOf.set(a.raw_name, a.muscle_group);
  for (const a of aliases) if (a.muscle_group && !groupOf.has(a.canonical_name)) groupOf.set(a.canonical_name, a.muscle_group);

  // Dataset match gives indirect muscles, and the main group for exercises with no alias group yet.
  const matchCache = new Map<string, ReturnType<typeof matchMuscle>>();
  const matchOf = (name: string) => {
    let m = matchCache.get(name);
    if (!m) matchCache.set(name, (m = matchMuscle(name, rows)));
    return m;
  };

  const today = todayIso();
  const since = addDays(today, -7 * 6);
  const items: CoachSession[] = history
    .filter((r) => r.date.slice(0, 10) >= since)
    .map((r) => ({
      date: r.date,
      muscle_group: groupOf.get(r.name) ?? groupOf.get(r.canonical_name) ?? matchOf(r.name).group,
      secondary: matchOf(r.name).secondary,
      sets: r.sets,
    }));
  return weeklyCoach(items, today);
}
