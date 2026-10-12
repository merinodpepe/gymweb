import { describe, expect, it } from "vitest";
import dataset from "@/data/exercises.json";
import { type DatasetRow, matchMuscle } from "@/domain/muscles/matchMuscle";

const rows = dataset as unknown as DatasetRow[];
const group = (n: string) => matchMuscle(n, rows);

describe("matchMuscle", () => {
  it.each([
    ["Lever Military Press", "Hombro"],
    ["Cable One Arm Lateral Raise", "Hombro"],
    ["Barbell Curl", "Bíceps"],
    ["Cable Kneeling Crunch", "Core"],
    ["Weighted Pull-Up", "Espalda"],
    ["Cable Standing Fly", "Pecho"],
    ["Chest Dip", "Pecho"],
  ])("exact: %s → %s", (n, g) => {
    expect(group(n)).toMatchObject({ group: g, match: "exact" });
  });

  it.each([
    ["Hammer Curl", "Bíceps"],
    ["Triceps Pushdown", "Tríceps"],
    ["Bent Over Row", "Espalda"],
    ["Cable Hammer Curl", "Bíceps"],
    ["EZ Barbell Preacher Curl", "Bíceps"],
    ["Incline Bench Press", "Pecho"],
    ["Close-Grip Bench Press", "Tríceps"],
  ])("similar: %s → %s", (n, g) => {
    const m = group(n);
    expect(m.match).not.toBe("none");
    expect(m.group).toBe(g);
  });

  it("gives something plausible for the hard ones, or nothing", () => {
    for (const n of ["Cable Standing Face Pull (with rope)", "Cable Wide-Grip Lat Pulldown"]) {
      const m = group(n);
      console.log(n, m);
      expect(["Hombro", "Espalda", null]).toContain(m.group);
    }
  });

  it("lists secondary groups, never the main one", () => {
    const press = group("Lever Military Press");
    expect(press.secondary).toContain("Tríceps");
    expect(press.secondary).not.toContain("Hombro");
    expect(group("Barbell Curl").secondary).toEqual(["Antebrazo"]);
  });

  it("returns none for unknown names", () => {
    expect(group("Foo Bar Zzz")).toEqual({ group: null, secondary: [], match: "none" });
  });
});
