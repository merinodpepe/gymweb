import { describe, expect, it } from "vitest";
import { type ApiWorkout, durationMinutes, mapApiWorkout, utcToLocal } from "@/domain/lyfta/mapApi";

const set = (weight: string, reps: string, type = "0") => ({ weight, reps, set_type_id: type });
const TZ = "Europe/Madrid";

const OCT_5: ApiWorkout = {
  id: 32527837,
  title: "Day 4: Shoulders, Arms & Abs",
  body_weight: 90,
  workout_perform_date: "2026-10-05 16:54:24",
  total_volume: 1900,
  exercises: [
    { excercise_name: "Lever Military Press", exercise_type: "weight_reps", sets: [set("36.000", "9", "1"), set("50.000", "6")] },
    { excercise_name: "Hammer Curl", exercise_type: "db_2_simultaneous", sets: [set("18.000", "8"), set("18.000", "10")] },
    { excercise_name: "Chest Dip", exercise_type: "full_bodyweight", sets: [{ weight: null, reps: "5", set_type_id: "0" }] },
    { excercise_name: "Run on Treadmill", exercise_type: "distance_duration", sets: [{ weight: "", reps: "", set_type_id: "0" }] },
  ],
};

describe("mapApiWorkout", () => {
  it("converts UTC to the app time zone (DST and winter)", () => {
    expect(utcToLocal("2026-10-05 16:54:24", TZ)).toBe("2026-10-05T18:54");
    expect(utcToLocal("2026-01-05 16:54:24", TZ)).toBe("2026-01-05T17:54");
  });

  it("parses durations", () => {
    expect(durationMinutes("03:01:15")).toBe(181);
    expect(durationMinutes("00:59:39")).toBe(60);
    expect(durationMinutes(null)).toBe(0);
  });

  it("maps sets, warm-ups, dumbbell pairs and bodyweight", () => {
    const { workout } = mapApiWorkout(OCT_5, { id: 32527837, description: " comentario ", workout_duration: "03:01:15" }, { timeZone: TZ });
    expect(workout.date).toBe("2026-10-05T18:54");
    expect(workout.duration_min).toBe(181);
    expect(workout.notes).toBe("comentario");
    expect(workout.exercises.map((e) => e.name)).toEqual(["Lever Military Press", "Hammer Curl", "Chest Dip"]);
    expect(workout.exercises[0].sets[0]).toEqual({ weight_kg: 36, reps: 9, is_warmup: true });
    expect(workout.exercises[1].sets[0]).toEqual({ weight_kg: 18, reps: 8, is_warmup: false, dumbbell_pair: true });
    expect(workout.exercises[2].sets[0]).toMatchObject({ weight_kg: 0, bodyweight_kg: 90 });
  });

  it("warns when Lyfta's volume does not match; cardio rows are dropped silently", () => {
    const ok = mapApiWorkout({ ...OCT_5, total_volume: 36 * 9 + 300 + 18 * 18 * 2 + 450 }, undefined, { timeZone: TZ });
    expect(ok.warnings).toEqual([]);
    const bad = mapApiWorkout(OCT_5, undefined, { timeZone: TZ });
    expect(bad.warnings[0]).toMatch(/no cuadra/);
  });

  it("uses user-marked dumbbell exercises too", () => {
    const { workout } = mapApiWorkout(OCT_5, undefined, { timeZone: TZ, dumbbells: new Set(["Lever Military Press"]) });
    expect(workout.exercises[0].sets[1].dumbbell_pair).toBe(true);
  });

  it("marks sets of type 4 as failure and leaves the rest unflagged", () => {
    const w: ApiWorkout = {
      ...OCT_5,
      exercises: [{ excercise_name: "Smith Calf Raise", exercise_type: "weight_reps", sets: [set("71.3", "15", "4"), set("81.3", "15", "0"), set("20", "10", "1")] }],
    };
    const [fail, normal, warm] = mapApiWorkout(w, undefined, { timeZone: TZ }).workout.exercises[0].sets;
    expect(fail).toMatchObject({ weight_kg: 71.3, reps: 15, is_warmup: false, is_failure: true });
    expect(normal).not.toHaveProperty("is_failure");
    expect(warm).toMatchObject({ is_warmup: true });
    expect(warm).not.toHaveProperty("is_failure");
  });
});
