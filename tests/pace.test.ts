import { describe, expect, it } from "vitest";
import { formatPace, isComparable, paceVsComparable, summarizeRuns, weightedPace } from "@/domain/stats/pace";

const runs = [
  { date: "2025-01-01", distance_km: 10, duration_s: 3000, surface: "outdoor" as const, elevation_gain_m: 50 },
  { date: "2025-01-03", distance_km: 2, duration_s: 480, surface: "outdoor" as const, elevation_gain_m: 10 },
];

describe("pace", () => {
  it("is Σtime/Σdistance, not the mean of paces", () => {
    // mean of paces would be (300 + 240)/2 = 270 s/km
    expect(weightedPace(runs)).toBeCloseTo(3480 / 12, 10);
    expect(weightedPace([])).toBeNull();
  });

  it("sums elevation", () => {
    expect(summarizeRuns(runs).elevation_gain_m).toBe(60);
  });

  it("formats", () => {
    expect(formatPace(290)).toBe("4:50 /km");
    expect(formatPace(null)).toBe("—");
  });

  it("compares only same-surface runs within ±20 % distance", () => {
    const ref = { date: "2025-02-01", distance_km: 10, duration_s: 2900, surface: "outdoor" as const };
    expect(isComparable(ref, runs[0])).toBe(true);
    expect(isComparable(ref, runs[1])).toBe(false);
    expect(isComparable(ref, { ...runs[0], surface: "treadmill" })).toBe(false);
    expect(paceVsComparable(ref, runs)).toBeCloseTo(-10, 10);
  });
});
