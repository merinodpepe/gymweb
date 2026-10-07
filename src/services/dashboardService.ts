import "server-only";
// The dashboard deliberately uses ONLY body and run data (see tests/arch.test.ts).
import { bodyRepo } from "@/repositories/bodyRepo";
import { runRepo } from "@/repositories/runRepo";
import { analyzeSteps, analyzeWeight } from "@/domain/stats/bodyTrend";
import { summarizeRuns } from "@/domain/stats/pace";
import { addDays, isoWeekStart } from "@/domain/stats/weeks";
import { parseRange } from "./range";

export async function getDashboard(range = "90d") {
  const { today, from } = parseRange(range);
  // Trend windows need up to 28 days before `from`.
  const fetchFrom = from ? addDays(from, -28) : undefined;
  const [body, runs] = await Promise.all([
    bodyRepo.list({ from: fetchFrom, to: today }),
    runRepo.list({ from: addDays(today, -365), to: today }),
  ]);

  const weights = body.filter((b) => b.weight_kg !== null).map((b) => ({ date: b.date, value: b.weight_kg! }));
  const steps = body.filter((b) => b.steps !== null).map((b) => ({ date: b.date, value: b.steps! }));
  const weight = analyzeWeight(weights, today);
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
      raw: inRange(weight.raw),
      ewma: inRange(weight.ewma),
      ma7: inRange(weight.ma7),
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
