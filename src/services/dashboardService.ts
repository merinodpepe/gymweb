import "server-only";
// The dashboard deliberately uses ONLY body and run data (see tests/arch.test.ts).
import { bodyRepo } from "@/repositories/bodyRepo";
import { runRepo } from "@/repositories/runRepo";
import { analyzeSteps, analyzeWeight } from "@/domain/stats/bodyTrend";
import { weeklyWeightChange } from "@/domain/insights/data";
import { summarizeRuns } from "@/domain/stats/pace";
import { calibrateScales, SCALE_WINDOW_DAYS } from "@/domain/stats/scaleCalibration";
import { addDays, isoWeekStart } from "@/domain/stats/weeks";
import { parseRange } from "./range";

export async function getDashboard(range = "90d") {
  const { today, from } = parseRange(range);
  // Trend windows need up to 28 days before `from`; scale calibration needs 180.
  const trendFrom = from ? addDays(from, -28) : undefined;
  const calibrationFrom = addDays(today, -SCALE_WINDOW_DAYS);
  const fetchFrom = trendFrom === undefined ? undefined : trendFrom < calibrationFrom ? trendFrom : calibrationFrom;
  const [body, runs, scaleNames] = await Promise.all([
    bodyRepo.list({ from: fetchFrom, to: today }),
    runRepo.list({ from: addDays(today, -365), to: today }),
    bodyRepo.scales(),
  ]);

  const weighIns = body.filter((b) => b.weight_kg !== null).map((b) => ({ date: b.date, value: b.weight_kg!, scale: b.scale }));
  const calibration = calibrateScales(weighIns, today);
  // Trend, EWMA and moving average use weights corrected to the mean of scales.
  const corrected = weighIns
    .filter((w) => !trendFrom || w.date >= trendFrom)
    .map((w) => ({ date: w.date, value: calibration.correct(w) }));
  const measured = weighIns.filter((w) => !from || w.date >= from);
  const steps = body.filter((b) => b.steps !== null && (!trendFrom || b.date >= trendFrom)).map((b) => ({ date: b.date, value: b.steps! }));
  const weight = analyzeWeight(corrected, today);
  const inRange = <T extends { date: string }>(xs: T[]) => (from ? xs.filter((x) => x.date >= from) : xs);

  const weekStart = isoWeekStart(today);
  const weekRuns = runs.filter((r) => r.date >= weekStart);

  return {
    today,
    range,
    weight: {
      current: weight.current,
      trend: weight.trend,
      label: weight.label,
      /** As measured (dots); `current`, trend and lines are corrected. */
      raw: measured.map(({ date, value }) => ({ date, value })),
      currentScale: weight.current ? (weighIns.find((w) => w.date === weight.current!.date)?.scale ?? null) : null,
      scales: calibration.scales,
      /** Weekly change of the EWMA weight (kg), complete weeks only. */
      weeklyChange: inRange(
        weeklyWeightChange(corrected, today).map((w) => ({ date: w.week_start, value: Math.round(w.change_kg * 100) / 100 })),
      ),
      ewma: inRange(weight.ewma),
      ma7: inRange(weight.ma7),
    },
    scaleNames,
    /** Energy (1–10) and body measurements, as logged. */
    measures: {
      energy: inRange(body.filter((b) => b.energy !== null).map((b) => ({ date: b.date, value: b.energy! }))),
      waist: inRange(body.filter((b) => b.waist_cm !== null).map((b) => ({ date: b.date, value: b.waist_cm! }))),
      arm: inRange(body.filter((b) => b.arm_cm !== null).map((b) => ({ date: b.date, value: b.arm_cm! }))),
    },
    steps: { ...analyzeSteps(steps, today), series: inRange(steps) },
    runs: {
      week: {
        treadmill: summarizeRuns(weekRuns.filter((r) => r.surface === "treadmill")),
        outdoor: summarizeRuns(weekRuns.filter((r) => r.surface === "outdoor")),
      },
      last: runs.at(-1) ?? null,
    },
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
