import { describe, expect, it } from "vitest";
import { ewmaIrregular, movingAverage } from "@/domain/stats/ewma";

describe("ewmaIrregular", () => {
  it("is a plain EWMA for unit spacing", () => {
    const out = ewmaIrregular(
      [
        { date: "2025-01-01", value: 80 },
        { date: "2025-01-02", value: 81 },
        { date: "2025-01-03", value: 79 },
      ],
      0.1,
      1,
    );
    expect(out.map((p) => p.value)).toEqual([80, 80.1, expect.closeTo(79.99, 10)]);
  });

  it("gives more weight after a gap", () => {
    const out = ewmaIrregular(
      [
        { date: "2025-01-01", value: 80 },
        { date: "2025-01-11", value: 70 },
      ],
      0.1,
      1,
    );
    // α_eff = 1 − 0.9^10 = 0.6513
    expect(out[1].value).toBeCloseTo(80 - 10 * (1 - 0.9 ** 10), 6);
  });
});

describe("movingAverage", () => {
  it("requires at least 4 observations in 7 days", () => {
    const pts = ["01", "02", "04", "06", "07"].map((d, i) => ({ date: `2025-01-${d}`, value: 80 + i }));
    const out = movingAverage(pts, 7, 4);
    expect(out.map((p) => p.date)).toEqual(["2025-01-06", "2025-01-07"]);
    expect(out[1].value).toBeCloseTo((80 + 81 + 82 + 83 + 84) / 5, 10);
  });
});
