import "server-only";
import { muscleReadiness } from "@/domain/coach/readiness";
import { type CoachSession, weeklyCoach } from "@/domain/coach/weeklyCoach";
import { addDays, nowLocalIso, todayIso } from "@/domain/stats/weeks";
import { workoutRepo } from "@/repositories/workoutRepo";
import { loadMuscleResolver } from "@/services/muscleService";

export async function getCoachReport() {
  const [history, muscles] = await Promise.all([workoutRepo.exerciseHistory(), loadMuscleResolver()]);

  const today = todayIso();
  const since = addDays(today, -7 * 5);
  const items: CoachSession[] = history
    .filter((r) => r.date.slice(0, 10) >= since)
    .map((r) => ({
      date: r.date,
      muscle_group: muscles.group(r.name, r.canonical_name),
      secondary: muscles.secondary(r.name),
      sets: r.sets,
    }));
  return { ...weeklyCoach(items, today), readiness: muscleReadiness(items, nowLocalIso()) };
}
