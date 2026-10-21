import { describe, expect, it } from "vitest";
import { parseStepsRollup, planStepUpdates } from "@/domain/google/parse";

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

  it("tolerates empty responses", () => {
    expect(parseStepsRollup({})).toEqual({ days: [], unreadable: 0 });
    expect(parseStepsRollup(null)).toEqual({ days: [], unreadable: 0 });
  });

  it("only raises steps", () => {
    const stored = [
      { date: "2026-10-19", steps: 9000 },
      { date: "2026-10-20", steps: 100 },
      { date: "2026-10-22", steps: null },
    ];
    expect(
      planStepUpdates(stored, [
        { date: "2026-10-19", steps: 8000 },
        { date: "2026-10-20", steps: 5000 },
        { date: "2026-10-21", steps: 300 },
        { date: "2026-10-22", steps: 0 },
      ]),
    ).toEqual([
      { date: "2026-10-20", steps: 5000 },
      { date: "2026-10-21", steps: 300 },
      { date: "2026-10-22", steps: 0 },
    ]);
  });
});
