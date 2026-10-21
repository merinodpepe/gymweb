import { describe, expect, it } from "vitest";
import { parseStepsRollup, parseWeightPoints, planBodyUpdates } from "@/domain/google/parse";

const day = (year: number, month: number, d: number) => ({ date: { year, month, day: d } });

describe("google health parsing", () => {
  it("reads daily step rollups (counts as strings)", () => {
    const r = parseStepsRollup({
      rollupDataPoints: [
        { civilStartTime: day(2026, 10, 20), steps: { countSum: "8123" } },
        { civilStartTime: day(2026, 10, 21), steps: { countSum: "412" } },
        { civilStartTime: day(2026, 10, 22), steps: {} },
      ],
    });
    expect(r.days).toEqual([
      { date: "2026-10-20", steps: 8123 },
      { date: "2026-10-21", steps: 412 },
    ]);
    expect(r.unreadable).toBe(1);
  });

  it("keeps the latest weight of each day, in kg", () => {
    const w = (physicalTime: string, grams: number, d = 20) => ({
      weight: { weightGrams: grams, sampleTime: { physicalTime, civilTime: day(2026, 10, d) } },
    });
    const r = parseWeightPoints({
      dataPoints: [w("2026-10-20T06:00:00Z", 79_400), w("2026-10-20T20:00:00Z", 78_950), w("2026-10-19T07:00:00Z", 80_000, 19)],
    });
    expect(r.days).toEqual([
      { date: "2026-10-19", weight_kg: 80 },
      { date: "2026-10-20", weight_kg: 78.95 },
    ]);
  });

  it("tolerates empty responses", () => {
    expect(parseStepsRollup({})).toEqual({ days: [], unreadable: 0 });
    expect(parseWeightPoints(null)).toEqual({ days: [], unreadable: 0 });
  });

  it("never overwrites a stored weight and only raises steps", () => {
    const stored = [
      { date: "2026-10-19", weight_kg: 80, steps: 9000 },
      { date: "2026-10-20", weight_kg: null, steps: 100 },
    ];
    const plan = planBodyUpdates(
      stored,
      [
        { date: "2026-10-19", steps: 8000 },
        { date: "2026-10-20", steps: 5000 },
        { date: "2026-10-21", steps: 300 },
      ],
      [
        { date: "2026-10-19", weight_kg: 79 },
        { date: "2026-10-20", weight_kg: 78.9 },
      ],
    );
    expect(plan).toEqual([
      { date: "2026-10-20", steps: 5000, weight_kg: 78.9 },
      { date: "2026-10-21", steps: 300 },
    ]);
  });
});
