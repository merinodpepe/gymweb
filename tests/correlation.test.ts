import { describe, expect, it } from "vitest";
import { benjaminiHochberg, bestLag, MIN_PAIRS, ranks, relate, spearman } from "@/domain/stats/correlation";
import { mulberry32 } from "@/domain/stats/util";
import { addDays } from "@/domain/stats/weeks";

describe("spearman", () => {
  it("ranks ties with their mean position", () => {
    expect(ranks([5, 6, 7, 8, 7])).toEqual([1, 2, 3.5, 5, 3.5]);
  });

  it("matches scipy.stats.spearmanr on a known example", () => {
    expect(spearman([1, 2, 3, 4, 5], [5, 6, 7, 8, 7])).toBeCloseTo(0.8207826816681233, 10);
  });

  it("is 1 for any monotone relation and −1 for a reversed one", () => {
    expect(spearman([1, 2, 3, 4], [1, 8, 27, 1000])).toBeCloseTo(1, 12);
    expect(spearman([1, 2, 3, 4], [9, 5, 2, 1])).toBeCloseTo(-1, 12);
  });

  it("is NaN when one side is constant", () => {
    expect(spearman([1, 2, 3, 4], [2, 2, 2, 2])).toBeNaN();
  });
});

describe("relate", () => {
  const rand = mulberry32(3);
  const xs = Array.from({ length: 40 }, (_, i) => i);

  it(`gives no coefficient below ${MIN_PAIRS} pairs (scatter only)`, () => {
    const r = relate(xs.slice(0, 29), xs.slice(0, 29));
    expect(r).toMatchObject({ n: 29, rho: null, ci95: null, p: null, enough: false });
  });

  it("detects a clear monotone relation with a CI that excludes 0", () => {
    const ys = xs.map((x) => x + (rand() - 0.5) * 6);
    const r = relate(xs, ys);
    expect(r.enough).toBe(true);
    expect(r.rho!).toBeGreaterThan(0.9);
    expect(r.ci95![0]).toBeGreaterThan(0.7);
    expect(r.p!).toBeLessThan(0.01);
  });

  it("finds nothing in independent noise", () => {
    const noise = xs.map(() => rand());
    const r = relate(xs, noise);
    expect(Math.abs(r.rho!)).toBeLessThan(0.45);
    expect(r.ci95![0]).toBeLessThan(0);
    expect(r.ci95![1]).toBeGreaterThan(0);
    expect(r.p!).toBeGreaterThan(0.01);
  });

  it("is reproducible (seeded)", () => {
    const ys = xs.map((x) => x + (rand() - 0.5) * 20);
    expect(relate(xs, ys)).toEqual(relate(xs, ys));
  });
});

describe("benjaminiHochberg", () => {
  it("keeps the p-values under the step-up line and ignores untested ones", () => {
    expect(benjaminiHochberg([0.001, 0.01, 0.03, 0.04, 0.5])).toEqual([true, true, true, true, false]);
    expect(benjaminiHochberg([0.5, null, 0.01])).toEqual([false, false, true]);
    expect(benjaminiHochberg([null, null])).toEqual([false, false]);
  });

  it("is stricter than testing each p-value alone", () => {
    // 0.04 < 0.05 alone, but with 5 tests the line for the 2nd smallest is 0.02.
    expect(benjaminiHochberg([0.04, 0.3, 0.5, 0.7, 0.9])).toEqual([false, false, false, false, false]);
  });
});

describe("bestLag", () => {
  const monday = "2026-01-05";
  const weeks = Array.from({ length: 40 }, (_, i) => addDays(monday, 7 * i));
  const rand = mulberry32(11);
  const x = new Map(weeks.map((w) => [w, rand() * 100]));
  // y reacts to x one week later.
  const y = new Map(weeks.slice(1).map((w, i) => [w, (x.get(weeks[i]) as number) * 0.5 + rand()]));

  it("recovers the lag at which y follows x", () => {
    const scan = bestLag(x, y, [0, 1, 2]);
    expect(scan.lag).toBe(1);
    expect(scan.tried).toBe(3);
    expect(scan.relation.rho!).toBeGreaterThan(0.9);
  });

  it("only pairs weeks present on both sides", () => {
    const scan = bestLag(x, y, [1]);
    expect(scan.pairs).toHaveLength(39);
  });

  it("falls back to scatter-only data when there are too few pairs", () => {
    const few = new Map([...x].slice(0, 10));
    const scan = bestLag(few, y, [0, 1]);
    expect(scan.relation.enough).toBe(false);
    expect(scan.pairs.length).toBeGreaterThan(0);
  });
});
