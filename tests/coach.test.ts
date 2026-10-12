import { describe, expect, it } from "vitest";
import { type CoachSession, weeklyCoach } from "@/domain/coach/weeklyCoach";
import { classify, DEFAULT_RANGE } from "@/domain/coach/volumeTargets";

const sets = (n: number, warm = 0) => [
  ...Array.from({ length: warm }, () => ({ weight_kg: 20, reps: 10, is_warmup: true })),
  ...Array.from({ length: n }, () => ({ weight_kg: 50, reps: 8, is_warmup: false })),
];
// Today = Wed 2026-10-14 → current week starts Mon 2026-10-12; the previous three start 10-05, 09-28, 09-21.
const TODAY = "2026-10-14";
const s = (date: string, group: string | null, n: number, secondary: string[] = [], warm = 0): CoachSession => ({
  date,
  muscle_group: group,
  secondary,
  sets: sets(n, warm),
});
const group = (items: CoachSession[], g: string) => weeklyCoach(items, TODAY).groups.find((x) => x.group === g)!;

describe("classify", () => {
  it.each([
    [5, "muy_bajo"],
    [5.9, "muy_bajo"],
    [6, "bajo"],
    [9, "bajo"],
    [10, "objetivo"],
    [20, "objetivo"],
    [21, "alto"],
  ])("%s sets → %s", (n, status) => {
    expect(classify(n, DEFAULT_RANGE)).toBe(status);
  });
});

describe("weeklyCoach", () => {
  it("counts working sets only and gives the current week plus 3 previous, oldest first", () => {
    const r = weeklyCoach([s("2026-10-13T10:00", "Pecho", 4, [], 2)], TODAY);
    expect(r.week_starts).toEqual(["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"]);
    const pecho = r.groups.find((g) => g.group === "Pecho")!;
    expect(pecho.current).toMatchObject({ direct: 4, total: 4, partial: true });
  });

  it("averages only the complete weeks (the partial one is excluded)", () => {
    const items = [
      s("2026-09-22", "Espalda", 12),
      s("2026-09-29", "Espalda", 12),
      s("2026-10-06", "Espalda", 12),
      s("2026-10-13", "Espalda", 30), // current week, ignored by the average
    ];
    const g = group(items, "Espalda");
    expect(g.average).toBe(12);
    expect(g.status).toBe("objetivo");
    expect(g.current.total).toBe(30);
    expect(g.current_deficit).toBe(0);
  });

  it("credits indirect work at half a set and keeps direct apart", () => {
    const g = group([s("2026-10-06", "Pecho", 6, ["Tríceps", "Hombro"])], "Tríceps");
    const w = g.weeks.find((x) => x.week_start === "2026-10-05")!;
    expect(w).toMatchObject({ direct: 0, total: 3 });
  });

  it("lists untrained groups with 0 and sorts the least trained first", () => {
    const r = weeklyCoach([s("2026-10-06", "Pecho", 12)], TODAY);
    expect(r.groups.find((g) => g.group === "Gemelo")).toMatchObject({ average: 0, status: "muy_bajo" });
    expect(r.groups.at(-1)!.group).toBe("Pecho");
    expect(r.groups.find((g) => g.group === "Gemelo")!.advice).toMatch(/No has entrenado/);
  });

  it("ignores workouts older than the window and counts sets without a group apart", () => {
    const r = weeklyCoach([s("2026-08-01", "Pecho", 20), s("2026-10-06", null, 5)], TODAY);
    expect(r.groups.find((g) => g.group === "Pecho")!.average).toBe(0);
    expect(r.unassigned_sets).toBe(5);
    expect(r.has_data).toBe(true);
  });

  it("reports what is still missing this week", () => {
    const g = group([s("2026-10-13", "Pecho", 4)], "Pecho");
    expect(g.current_deficit).toBe(6);
  });

  it("flags a single weekly session as low frequency", () => {
    const items = [22, 29].map((d) => s(`2026-09-${d}`, "Pecho", 12)).concat(s("2026-10-06", "Pecho", 12));
    const g = group(items, "Pecho");
    expect(g.frequency).toBe(1);
    expect(g.advice).toMatch(/2 sesiones/);
  });
});
