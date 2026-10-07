import { describe, expect, it } from "vitest";
import { analyzeSteps, analyzeWeight } from "@/domain/stats/bodyTrend";
import { computePrs } from "@/domain/stats/prs";
import { acuteChronicRatio, weeklyVolume } from "@/domain/stats/volume";
import { isoWeekKey, isoWeekStart, todayIso } from "@/domain/stats/weeks";

describe("weeks", () => {
  it("computes ISO weeks", () => {
    expect(isoWeekStart("2025-10-09")).toBe("2025-10-06");
    expect(isoWeekStart("2025-10-12")).toBe("2025-10-06");
    expect(isoWeekKey("2025-10-09")).toBe("2025-W41");
    expect(isoWeekKey("2021-01-03")).toBe("2020-W53");
  });
  it("today in Madrid", () => {
    expect(todayIso(new Date("2025-06-30T22:30:00Z"), "Europe/Madrid")).toBe("2025-07-01");
  });
});

describe("weight", () => {
  it("uses today, else yesterday, never zero-fills", () => {
    const raw = [
      { date: "2025-01-01", value: 80 },
      { date: "2025-01-09", value: 79.5 },
    ];
    expect(analyzeWeight(raw, "2025-01-10").current).toEqual({ date: "2025-01-09", value: 79.5 });
    expect(analyzeWeight(raw, "2025-01-12").current).toBeNull();
  });

  it("finds a downward trend", () => {
    const raw = Array.from({ length: 20 }, (_, i) => ({
      date: `2025-02-${String(i + 1).padStart(2, "0")}`,
      value: 85 - 0.1 * i + (i % 3 === 0 ? 0.2 : 0),
    }));
    const a = analyzeWeight(raw, "2025-02-20");
    expect(a.trend!.slope).toBeCloseTo(-0.7, 0);
    expect(a.label).toBe("down");
  });
});

describe("steps", () => {
  it("averages only days with data", () => {
    const s = analyzeSteps(
      [
        { date: "2025-01-08", value: 10000 },
        { date: "2025-01-10", value: 6000 },
      ],
      "2025-01-10",
    );
    expect(s.mean7).toBe(8000);
    expect(s.days7).toBe(2);
    expect(s.today).toBe(6000);
  });
});

describe("PRs", () => {
  it("only strict improvements count", () => {
    const { current, events } = computePrs([
      { date: "2025-01-01", sets: [{ weight_kg: 100, reps: 5, is_warmup: false }] },
      { date: "2025-01-08", sets: [{ weight_kg: 100, reps: 5, is_warmup: false }] },
      { date: "2025-01-15", sets: [{ weight_kg: 102.5, reps: 3, is_warmup: false }] },
    ]);
    const fiveRm = current.find((r) => r.kind === "5RM")!;
    expect(fiveRm).toEqual({ kind: "5RM", value: 100, date: "2025-01-01" });
    expect(current.find((r) => r.kind === "3RM")!.date).toBe("2025-01-15");
    expect(events.filter((e) => e.date === "2025-01-08")).toEqual([]);
  });
});

describe("volume", () => {
  it("counts working sets per group and marks the current week partial", () => {
    const set = (w: number, warm = false) => ({ weight_kg: w, reps: 10, is_warmup: warm });
    const weeks = weeklyVolume(
      [
        { date: "2025-10-01", muscle_group: "Pecho", sets: [set(20, true), set(50), set(50)] },
        { date: "2025-10-07", muscle_group: "Pecho", sets: [set(55)] },
        { date: "2025-10-08", muscle_group: null, sets: [set(10)] },
      ],
      "2025-10-08",
    );
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toMatchObject({ partial: false, sets_by_group: { Pecho: 2 }, tonnage_kg: 1000 });
    expect(weeks[1]).toMatchObject({ partial: true, sets_by_group: { Pecho: 1, "Sin grupo": 1 } });
    expect(acuteChronicRatio([{ date: "2025-10-08", muscle_group: null, sets: [set(10)] }], "2025-10-08")).toBe(4);
  });
});
