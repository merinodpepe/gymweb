import { describe, expect, it } from "vitest";
import { parseLyfta, parseNumber } from "@/domain/lyfta/parseLyfta";
import { LYFTA_EXAMPLE } from "./fixtures";

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
