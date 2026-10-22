import "server-only";
import { buildAlerts } from "@/domain/insights/alerts";
import { hourOfDay, repDistribution, volumeCalendar } from "@/domain/insights/charts";
import {
  applyFdr,
  crossFrequencyProgress,
  crossKmWeight,
  crossRestSession,
  crossRunLegs,
  crossStepsWeight,
  crossVolumeProgress,
  legsWeightBox,
  paceVsWeight,
  positionAnalysis,
  relativeStrength,
  routineAdherence,
  scaleDrift,
  surfaceAtEffort,
  strengthWindows,
  volumeBins,
  weightStrengthQuadrants,
} from "@/domain/insights/crosses";
import type { InsightData, InsightSession } from "@/domain/insights/data";
import { monthKey, monthlyReport } from "@/domain/insights/report";
import { calibrateScales, type WeighIn } from "@/domain/stats/scaleCalibration";
import { addDays, todayIso } from "@/domain/stats/weeks";
import { bodyRepo } from "@/repositories/bodyRepo";
import { runRepo } from "@/repositories/runRepo";
import { workoutRepo } from "@/repositories/workoutRepo";
import { loadMuscleResolver } from "@/services/muscleService";

/** History needed by the cross-views (a year is enough for 26-week windows and 12 monthly reports). */
const HISTORY_DAYS = 400;

/** Exercise history since `from` as insight sessions, with each exercise's muscle group resolved. */
async function loadSessions(from: string): Promise<InsightSession[]> {
  const [history, muscles] = await Promise.all([workoutRepo.exerciseHistory(), loadMuscleResolver()]);
  return history
    .filter((r) => r.date.slice(0, 10) >= from)
    .map((r) => ({
      date: r.date,
      routine: r.routine_name,
      position: r.position,
      exercise: r.canonical_name,
      muscle_group: muscles.group(r.name, r.canonical_name),
      sets: r.sets,
    }));
}

/** Body weight (corrected for scale bias), steps, runs and exercise history in the shape the insights read. */
export async function loadInsightData(): Promise<InsightData & { weighIns: WeighIn[] }> {
  const today = todayIso();
  const from = addDays(today, -HISTORY_DAYS);
  const [body, runs, sessions] = await Promise.all([
    bodyRepo.list({ from, to: today }),
    runRepo.list({ from, to: today }),
    loadSessions(from),
  ]);
  const weighIns: WeighIn[] = body.filter((b) => b.weight_kg !== null).map((b) => ({ date: b.date, value: b.weight_kg!, scale: b.scale }));
  const calibration = calibrateScales(weighIns, today);
  return {
    today,
    weighIns,
    weights: weighIns.map((w) => ({ date: w.date, value: calibration.correct(w) })),
    steps: body.filter((b) => b.steps !== null).map((b) => ({ date: b.date, value: b.steps! })),
    runs,
    sessions,
  };
}

function scatterCrosses(data: InsightData) {
  const windows = strengthWindows(data);
  const pace = paceVsWeight(data);
  const crosses = applyFdr([
    crossKmWeight(data),
    crossStepsWeight(data),
    crossRunLegs(data),
    crossFrequencyProgress(windows),
    crossVolumeProgress(windows),
    crossRestSession(data),
    ...pace.map((p) => p.cross),
  ]);
  return { crosses, windows, pace };
}

/** Calendar with volume, rep ranges per muscle and time of day, for the workouts page. */
export async function getTrainingCharts() {
  const today = todayIso();
  const sessions = await loadSessions(addDays(today, -HISTORY_DAYS));
  return {
    calendar: volumeCalendar(sessions, today, 3),
    reps: repDistribution(sessions, today, 8),
    hours: hourOfDay(sessions),
  };
}

export async function getAlerts() {
  return buildAlerts(await loadInsightData());
}

export async function getAnalysis() {
  const data = await loadInsightData();
  const { crosses, windows, pace } = scatterCrosses(data);
  return {
    today: data.today,
    alerts: buildAlerts(data),
    crosses: crosses.filter((c) => !c.id.startsWith("ritmo-peso")),
    pace: pace.map((p, i) => ({ ...p, cross: crosses.find((c) => c.id === p.cross.id) ?? pace[i].cross })),
    volumeBins: volumeBins(windows),
    legs: legsWeightBox(data),
    position: positionAnalysis(data),
    quadrants: weightStrengthQuadrants(data),
    relative: relativeStrength(data),
    adherence: routineAdherence(data),
    drift: scaleDrift(data.weighIns, data.today),
    effort: surfaceAtEffort(data.runs),
  };
}

export async function getMonthlyReport(month?: string) {
  const data = await loadInsightData();
  const { crosses } = scatterCrosses(data);
  const key = month && /^\d{4}-\d{2}$/.test(month) ? month : monthKey(data.today);
  return { today: data.today, report: monthlyReport(data, key, crosses) };
}
