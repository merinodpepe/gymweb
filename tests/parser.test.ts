import { describe, expect, it } from "vitest";
import { parseLyfta, parseNumber } from "@/domain/lyfta/parseLyfta";
import { sessionE1rm } from "@/domain/stats/e1rm";
import { tonnage } from "@/domain/stats/volume";
import { LYFTA_BACK_BW, LYFTA_CHEST_BW, LYFTA_EXAMPLE, LYFTA_REAL } from "./fixtures";

describe("parseNumber", () => {
  it("handles thousands spaces and decimal separators", () => {
    expect(parseNumber("6 893.5")).toBe(6893.5);
    expect(parseNumber("6 893,5")).toBe(6893.5);
    expect(parseNumber("72,5")).toBe(72.5);
    expect(parseNumber("1.234,5")).toBe(1234.5);
    expect(parseNumber("1,234.5")).toBe(1234.5);
  });
});

describe("parseLyfta", () => {
  it("parses the reference example exactly", () => {
    const { workout, warnings, checks } = parseLyfta(LYFTA_EXAMPLE);
    expect(workout.routine_name).toBe("Hombro y Bíceps");
    expect(workout.date).toBe("2025-10-07T18:32");
    expect(workout.duration_min).toBe(65);
    expect(workout.total_volume_kg).toBe(2005);
    expect(workout.exercises).toHaveLength(2);

    const [press, curl] = workout.exercises;
    expect(press.name).toBe("Lever Military Press");
    expect(press.notes).toBeNull();
    expect(press.sets).toEqual([
      { weight_kg: 20, reps: 12, is_warmup: true },
      { weight_kg: 40, reps: 10, is_warmup: false },
      { weight_kg: 45, reps: 8, is_warmup: false },
      { weight_kg: 45, reps: 7, is_warmup: false },
    ]);
    expect(curl.name).toBe("Barbell Curl");
    expect(curl.notes).toBe("barra corta, sin contar peso barra");
    expect(curl.sets).toHaveLength(3);

    expect(warnings).toEqual([]);
    expect(checks.parsed_sets).toBe(7);
    // 240 + 400 + 360 + 315 + 240 + 250 + 200 = 2005 (all), 1765 (working)
    expect(checks.volume_all_sets).toBe(2005);
    expect(checks.volume_working_sets).toBe(1765);
    expect(workout.raw_text).toBe(LYFTA_EXAMPLE);
  });

  it("detects which volume rule Lyfta uses", () => {
    const all = parseLyfta(LYFTA_EXAMPLE);
    expect(all.checks.volume_rule).toBe("all_sets");
    const working = parseLyfta(LYFTA_EXAMPLE.replace("2 005 kg", "1 765 kg"));
    expect(working.checks.volume_rule).toBe("working_sets");
    const none = parseLyfta(LYFTA_EXAMPLE.replace("2 005 kg", "1 620 kg"));
    expect(none.checks.volume_rule).toBeNull();
  });

  it("accepts comma decimals, no hours and CRLF", () => {
    const text = [
      "Pierna",
      "lunes, 3 de marzo de 2025, 7:05",
      "45m | 1 305,0 kg | 1 Ejercicios | 2 series",
      "",
      "Squat",
      "Serie 1: 72,5 kg x 10 reps",
      "Serie 2: 72,5 kg x 8 reps",
    ].join("\r\n");
    const { workout, warnings, checks } = parseLyfta(text);
    expect(workout.date).toBe("2025-03-03T07:05");
    expect(workout.duration_min).toBe(45);
    expect(workout.total_volume_kg).toBe(1305);
    expect(workout.exercises[0].sets[0].weight_kg).toBe(72.5);
    expect(checks.volume_rule).toBe("all_sets");
    expect(warnings).toEqual([]);
  });

  it("warns about an exercise without sets", () => {
    const text = `Push
viernes, 1 de agosto de 2025, 19:00
30m | 500 kg | 2 Ejercicios | 1 series
Bench Press
Serie 1: 50 kg x 10 reps
Dips`;
    const { workout, warnings } = parseLyfta(text);
    expect(workout.exercises.map((e) => e.name)).toEqual(["Bench Press", "Dips"]);
    expect(workout.exercises[1].sets).toEqual([]);
    expect(warnings.some((w) => w.includes("Dips"))).toBe(true);
  });

  it("joins multi-line notes", () => {
    const text = `X
sábado, 2 de agosto de 2025, 10:00
10m | 100 kg | 1 Ejercicio | 1 serie
Row
nota 1
nota 2
Serie 1: 10 kg x 10 reps`;
    const { workout, warnings } = parseLyfta(text);
    expect(workout.exercises[0].notes).toBe("nota 1\nnota 2");
    expect(warnings).toEqual([]);
  });

  it("never throws on garbage and reports warnings", () => {
    const { workout, warnings } = parseLyfta("hola que tal\nesto no es un entreno");
    expect(workout.exercises.length).toBeGreaterThanOrEqual(0);
    expect(warnings.length).toBeGreaterThan(0);
    expect(() => parseLyfta("")).not.toThrow();
  });

  it("flags header count mismatches", () => {
    const { warnings } = parseLyfta(LYFTA_EXAMPLE.replace("7 series", "9 series"));
    expect(warnings.some((w) => w.includes("9 series"))).toBe(true);
  });
});

describe("parseLyfta with a real Lyfta export", () => {
  const { workout, warnings, checks } = parseLyfta(LYFTA_REAL);

  it("reads header, date and duration", () => {
    expect(workout.routine_name).toBe("Day 4: Shoulders, Arms & Abs");
    expect(workout.date).toBe("2026-10-05T18:54");
    expect(workout.duration_min).toBe(181);
    expect(workout.total_volume_kg).toBe(6893.5);
  });

  it("strips the exercise numbering and ignores the share footer", () => {
    expect(workout.exercises.map((e) => e.name)).toEqual([
      "Lever Military Press",
      "Cable One Arm Lateral Raise",
      "Cable Standing Face Pull (with rope)",
      "Barbell Curl",
      "Close-Grip Bench Press",
      "Hammer Curl",
      "Triceps Pushdown",
      "Cable Kneeling Crunch",
    ]);
    expect(workout.exercises[3].notes).toBe("barra corta, sin contar peso barra");
    expect(workout.exercises.every((e) => e.notes === null || !e.notes.includes("lyfta.app"))).toBe(true);
  });

  it("parses sets with no space before kg and decimal weights", () => {
    expect(workout.exercises[0].sets[0]).toEqual({ weight_kg: 36, reps: 9, is_warmup: true });
    expect(workout.exercises[1].sets[0]).toEqual({ weight_kg: 11.3, reps: 13, is_warmup: false });
    expect(workout.exercises[7].sets[1]).toEqual({ weight_kg: 70.3, reps: 12, is_warmup: false });
  });

  it("matches the header counts", () => {
    expect(checks.parsed_exercises).toBe(8);
    expect(checks.parsed_sets).toBe(21);
  });

  it("deduces that Hammer Curl is the dumbbell exercise Lyfta counts ×2", () => {
    // Lyfta reports 6893.5 kg; Σ(weight × reps) is 6569.5. The 324 kg gap is exactly
    // the Hammer Curl volume (18×8 + 18×10): only that subset of exercises fits.
    expect(checks.dumbbell_inferred).toEqual(["Hammer Curl"]);
    expect(workout.exercises[5].sets.every((x) => x.dumbbell_pair)).toBe(true);
    expect(workout.exercises[0].sets.some((x) => x.dumbbell_pair)).toBe(false);
    expect(checks.volume_all_sets).toBe(6893.5);
    expect(checks.volume_rule).toBe("all_sets");
    expect(warnings).toEqual([]);
  });

  it("uses known dumbbell exercises without needing to deduce them", () => {
    const known = parseLyfta(LYFTA_REAL, { dumbbells: new Set(["Hammer Curl"]) });
    expect(known.checks.dumbbell_inferred).toEqual([]);
    expect(known.checks.volume_rule).toBe("all_sets");
    expect(known.workout.exercises[5].sets[0]).toEqual({ weight_kg: 18, reps: 8, is_warmup: false, dumbbell_pair: true });
  });
});

describe("parseLyfta with bodyweight exercises and comments", () => {
  const back = parseLyfta(LYFTA_BACK_BW);
  const chest = parseLyfta(LYFTA_CHEST_BW);

  it("reads the workout comment between the date and the summary", () => {
    expect(back.workout.notes).toBe("me cago en la puta estaba mar, he entrenado fuerte pero joder");
    expect(back.workout.duration_min).toBe(66);
    expect(back.workout.total_volume_kg).toBe(5318.1);
    expect(back.workout.exercises[0].name).toBe("Cable Wide-Grip Lat Pulldown");
    expect(chest.workout.notes).toBeNull();
  });

  it("keeps exercise comments as notes", () => {
    expect(back.workout.exercises[2].notes).toBe("vamos a parar para evitar lesiones");
    expect(back.workout.exercises[4].notes).toBe("el primero lo he hecho unilateral");
    expect(back.workout.exercises[5].notes).toBe("peso sin barra");
  });

  it("strips «(+ BW x kg)» from the name and stores the bodyweight per set", () => {
    const pullUp = back.workout.exercises[1];
    expect(pullUp.name).toBe("Weighted Pull-Up");
    expect(pullUp.sets[0]).toEqual({ weight_kg: 0, reps: 7, is_warmup: false, bodyweight_kg: 90 });
    expect(chest.workout.exercises[2].name).toBe("Chest Dip");
    expect(back.workout.exercises[0].sets[0].bodyweight_kg).toBeUndefined();
  });

  it("matches Lyfta's volume once bodyweight × reps is added", () => {
    expect(back.checks.volume_all_sets).toBe(5318.1);
    expect(back.checks.volume_rule).toBe("all_sets");
    expect(back.warnings).toEqual([]);
    expect(chest.checks.volume_all_sets).toBe(3067.1);
    expect(chest.checks.volume_rule).toBe("all_sets");
    expect(chest.warnings).toEqual([]);
  });

  it("uses bodyweight + added load for e1RM and tonnage", () => {
    const dips = chest.workout.exercises[2].sets;
    expect(tonnage(dips)).toBe(90 * 13);
    expect(sessionE1rm(dips)).toBeCloseTo((90 * (1 + 5 / 30) + (90 * 36) / 32) / 2, 6);
  });
});

describe("dumbbells and optional comments", () => {
  const base = (header: string, body: string) => `Rutina
lunes, 12 de octubre de 2026, 10:00
${header}
${body}`;

  it("does not guess when several exercise groups explain the gap", () => {
    const { checks, warnings } = parseLyfta(
      base(
        // 300 − 200 = 100 kg: either A or B could be the dumbbell one.
        "30m | 300kg | 2 Ejercicios | 2 series",
        "A\nSerie 1: 10kg x 10 reps\nB\nSerie 1: 10kg x 10 reps",
      ),
    );
    expect(checks.dumbbell_inferred).toEqual([]);
    expect(checks.volume_rule).toBeNull();
    expect(warnings.some((w) => w.includes("varios grupos"))).toBe(true);
  });

  it("recognises dumbbells by name", () => {
    const { workout, checks } = parseLyfta(
      base("30m | 400kg | 1 Ejercicios | 1 series", "Dumbbell Bench Press\nSerie 1: 20kg x 10 reps"),
    );
    expect(workout.exercises[0].sets[0].dumbbell_pair).toBe(true);
    expect(checks.dumbbell_inferred).toEqual([]);
    expect(checks.volume_rule).toBe("all_sets");
  });

  it("doubles dumbbell volume in tonnage but not in e1RM", () => {
    const sets = [{ weight_kg: 20, reps: 5, is_warmup: false, dumbbell_pair: true as const }];
    expect(tonnage(sets)).toBe(200);
    expect(sessionE1rm(sets)).toBeCloseTo(sessionE1rm([{ weight_kg: 20, reps: 5, is_warmup: false }])!, 9);
  });

  it("handles a multi-line workout comment, exercises with and without notes, and no comment", () => {
    const { workout, warnings } = parseLyfta(
      base(
        "primera línea\nsegunda línea\n30m | 300kg | 2 Ejercicios | 2 series",
        "A\nnota de A\nSerie 1: 10kg x 10 reps\nB\nSerie 1: 20kg x 10 reps",
      ),
    );
    expect(workout.notes).toBe("primera línea\nsegunda línea");
    expect(workout.exercises.map((e) => e.notes)).toEqual(["nota de A", null]);
    expect(warnings).toEqual([]);
    const plain = parseLyfta(base("30m | 100kg | 1 Ejercicios | 1 series", "A\nSerie 1: 10kg x 10 reps"));
    expect(plain.workout.notes).toBeNull();
    expect(plain.workout.exercises[0].notes).toBeNull();
  });
});
