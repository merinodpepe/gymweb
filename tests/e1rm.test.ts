import { describe, expect, it } from "vitest";
import { brzycki, epley, sessionE1rm, setE1rm } from "@/domain/stats/e1rm";

describe("e1RM", () => {
  it("matches hand-computed formulas", () => {
    expect(epley(100, 5)).toBeCloseTo(116.6667, 4);
    expect(brzycki(100, 5)).toBeCloseTo(112.5, 4);
    expect(setE1rm(100, 5)).toBeCloseTo(114.5833, 4);
    expect(setE1rm(100, 1)).toBe(100);
  });

  it("takes the best eligible set per session, ignoring warm-ups and >10 reps", () => {
    const e = sessionE1rm([
      { weight_kg: 120, reps: 3, is_warmup: true },
      { weight_kg: 60, reps: 15, is_warmup: false },
      { weight_kg: 100, reps: 5, is_warmup: false },
      { weight_kg: 105, reps: 2, is_warmup: false },
    ]);
    // 105×2: epley 112, brzycki 108 → 110; 100×5 → 114.58
    expect(e).toBeCloseTo(114.5833, 4);
    expect(sessionE1rm([{ weight_kg: 60, reps: 12, is_warmup: false }])).toBeNull();
  });
});
