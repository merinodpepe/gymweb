import { describe, expect, it } from "vitest";
import { FULL_FATIGUE_SETS, muscleReadiness, READY_AT, tauFor } from "@/domain/coach/readiness";
import type { CoachSession } from "@/domain/coach/weeklyCoach";

const NOW = "2026-10-14T18:00";
const sets = (n: number, { warm = 0, failure = 0 } = {}) => [
  ...Array.from({ length: warm }, () => ({ weight_kg: 20, reps: 10, is_warmup: true })),
  ...Array.from({ length: n }, (_, i) => ({
    weight_kg: 50,
    reps: 8,
    is_warmup: false,
    ...(i < failure && { is_failure: true as const }),
  })),
];
const s = (date: string, group: string | null, n: number, opts: { secondary?: string[]; warm?: number; failure?: number } = {}): CoachSession => ({
  date,
  muscle_group: group,
  secondary: opts.secondary ?? [],
  sets: sets(n, opts),
});
const get = (items: CoachSession[], g: string, now = NOW) => muscleReadiness(items, now).find((x) => x.group === g)!;

describe("muscleReadiness", () => {
  it("everything is ready without recent sessions", () => {
    const r = muscleReadiness([], NOW);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((g) => g.level === "listo" && g.readiness === 1 && g.hours_to_ready === 0)).toBe(true);
  });

  it("a hard chest session an hour ago leaves chest fatigued", () => {
    const g = get([s("2026-10-14T17:00", "Pecho", 10)], "Pecho");
    expect(g.level).toBe("fatigado");
    expect(g.hours_to_ready).toBeGreaterThan(48);
    expect(g.last_session).toBe("2026-10-14");
    expect(g.recent_sets).toBe(10);
  });

  it("the same session 72 h ago is recovered", () => {
    expect(get([s("2026-10-11T18:00", "Pecho", 10)], "Pecho").level).toBe("listo");
  });

  it("secondary muscles get half the load", () => {
    const items = [s("2026-10-14T16:00", "Pecho", 10, { secondary: ["Tríceps"] })];
    const pecho = get(items, "Pecho");
    const triceps = get(items, "Tríceps");
    expect(triceps.recent_sets).toBe(5);
    const fatigue = (r: number) => (1 - r) * FULL_FATIGUE_SETS;
    expect(fatigue(triceps.readiness)).toBeCloseTo(fatigue(pecho.readiness) * 0.5 * Math.exp(-2 / tauFor("Tríceps")) / Math.exp(-2 / tauFor("Pecho")), 6);
  });

  it("sets to failure cost more than normal ones", () => {
    const normal = get([s("2026-10-14T12:00", "Bíceps", 6)], "Bíceps");
    const failure = get([s("2026-10-14T12:00", "Bíceps", 6, { failure: 3 })], "Bíceps");
    expect(failure.readiness).toBeLessThan(normal.readiness);
  });

  it("ignores warm-ups and sessions outside the window", () => {
    expect(get([s("2026-10-14T17:00", "Pecho", 0, { warm: 5 })], "Pecho").readiness).toBe(1);
    expect(get([s("2026-10-01T17:00", "Pecho", 20)], "Pecho").last_session).toBeNull();
    expect(get([s("2026-10-15T09:00", "Pecho", 20)], "Pecho").readiness).toBe(1);
  });

  it("dates without a time count as trained at 18:00", () => {
    expect(get([s("2026-10-14", "Pecho", 10)], "Pecho").readiness).toBeCloseTo(get([s("2026-10-14T18:00", "Pecho", 10)], "Pecho").readiness, 9);
  });

  it("is ready once hours_to_ready have passed", () => {
    const items = [s("2026-10-14T10:00", "Espalda", 14), s("2026-10-13T10:00", "Espalda", 6)];
    const { hours_to_ready } = get(items, "Espalda");
    const later = new Date(Date.parse(`${NOW}:00Z`) + hours_to_ready * 3_600_000).toISOString().slice(0, 16);
    const before = new Date(Date.parse(`${NOW}:00Z`) + (hours_to_ready - 1) * 3_600_000).toISOString().slice(0, 16);
    expect(get(items, "Espalda", later).readiness).toBeGreaterThanOrEqual(READY_AT - 1e-9);
    expect(get(items, "Espalda", before).readiness).toBeLessThan(READY_AT);
  });

  it("sorts the most fatigued first", () => {
    const r = muscleReadiness([s("2026-10-14T17:00", "Gemelo", 10)], NOW);
    expect(r[0].group).toBe("Gemelo");
  });
});
