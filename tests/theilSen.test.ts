import { describe, expect, it } from "vitest";
import { olsFit, trendLabel } from "@/domain/stats/regression";
import { theilSen } from "@/domain/stats/theilSen";
import { tCrit95 } from "@/domain/stats/util";
import { strengthTrend } from "@/domain/stats/strengthTrend";

const xs = [0, 1, 2, 3, 4, 5, 6.5, 8];
const ys = [100, 101.5, 101, 103, 104.5, 104, 106, 108];

describe("regression (reference values from scipy 1.15)", () => {
  it("OLS slope and t CI match scipy.stats.linregress", () => {
    const f = olsFit(xs, ys)!;
    expect(f.slope).toBeCloseTo(0.957712924359738, 9);
    expect(f.intercept).toBeCloseTo(99.96843359142346, 9);
    expect(f.ci95[0]).toBeCloseTo(0.7451843444924654, 3);
    expect(f.ci95[1]).toBeCloseTo(1.1702415042270107, 3);
  });

  it("Theil-Sen slope matches scipy.stats.theilslopes", () => {
    const f = theilSen(xs, ys)!;
    expect(f.slope).toBe(1);
    expect(f.intercept).toBe(100);
    expect(f.ci95[0]).toBeLessThan(1);
    expect(f.ci95[1]).toBeGreaterThan(1);
    expect(f.ci95[0]).toBeGreaterThan(0);
  });

  it("bootstrap is deterministic", () => {
    expect(theilSen(xs, ys)!.ci95).toEqual(theilSen(xs, ys)!.ci95);
  });

  it("is robust to an outlier", () => {
    const yo = [...ys];
    yo[3] = 140;
    expect(theilSen(xs, yo)!.slope).toBeCloseTo(1, 0);
  });

  it("t critical values", () => {
    expect(tCrit95(6)).toBeCloseTo(2.4469, 4);
    expect(tCrit95(35)).toBeCloseTo(2.0301, 3);
    expect(tCrit95(50)).toBeCloseTo(2.0086, 3);
    expect(tCrit95(200)).toBeCloseTo(1.9719, 3);
  });

  it("labels only when CI excludes 0", () => {
    expect(trendLabel([0.1, 0.5], 0.3)).toBe("up");
    expect(trendLabel([-0.5, -0.1], -0.3)).toBe("down");
    expect(trendLabel([-0.1, 0.5], 0.2)).toBe("flat");
    expect(trendLabel([0.01, 0.09], 0.05, 0.1)).toBe("flat");
  });
});

describe("strengthTrend", () => {
  it("shows only points with < 3 sessions", () => {
    const t = strengthTrend([
      { date: "2025-01-01", value: 100 },
      { date: "2025-01-08", value: 101 },
    ]);
    expect(t.ewma).toEqual([]);
    expect(t.theilSen).toBeNull();
    expect(t.label).toBeNull();
  });

  it("detects a clear improvement in kg/week", () => {
    const pts = Array.from({ length: 10 }, (_, i) => ({
      date: new Date(Date.UTC(2025, 0, 1 + 7 * i)).toISOString().slice(0, 10),
      value: 100 + 1.0 * i + (i % 2 ? 0.3 : -0.3),
    }));
    const t = strengthTrend(pts);
    expect(t.theilSen!.slope).toBeGreaterThan(0.8);
    expect(t.label).toBe("up");
    expect(t.typicalError).toBeGreaterThan(0);
  });
});
