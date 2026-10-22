import { describe, expect, it } from "vitest";
import { buildAlerts } from "@/domain/insights/alerts";
import { hourOfDay, repDistribution, volumeCalendar, weekdayProfile, weeklyPace } from "@/domain/insights/charts";
import {
  applyFdr,
  crossFrequencyProgress,
  legsWeightBox,
  positionAnalysis,
  quadrantOf,
  relativeStrength,
  routineAdherence,
  strengthWindows,
  volumeBins,
} from "@/domain/insights/crosses";
import { type InsightData, type InsightSession, weeklyKm, weeklyStepsMean, weeklyWeightChange } from "@/domain/insights/data";
import { monthBounds, monthlyReport } from "@/domain/insights/report";
import { setE1rm } from "@/domain/stats/e1rm";
import { addDays } from "@/domain/stats/weeks";

// Thursday. The current week starts Mon 2026-10-19, the last complete one Mon 2026-10-12.
const TODAY = "2026-10-22";
const MONDAY = "2026-04-06"; // 28 weeks before the current one
const day = (n: number) => addDays(MONDAY, n);
const F5 = setE1rm(1, 5);

/** A working set whose e1RM is `e1rm` (5 reps). */
const setFor = (e1rm: number) => ({ weight_kg: e1rm / F5, reps: 5, is_warmup: false });
const session = (
  date: string,
  exercise: string,
  group: string | null,
  e1rm: number,
  { sets = 4, routine = "Día A", position = 0, time = "18:00" } = {},
): InsightSession => ({
  date: `${date}T${time}`,
  routine,
  position,
  exercise,
  muscle_group: group,
  sets: Array.from({ length: sets }, () => setFor(e1rm)),
});
const data = (over: Partial<InsightData> = {}): InsightData => ({ today: TODAY, weights: [], steps: [], runs: [], sessions: [], ...over });
const run = (date: string, km: number, minutes: number, surface: "outdoor" | "treadmill" = "outdoor", elevation = 0) => ({
  date,
  distance_km: km,
  duration_s: minutes * 60,
  surface,
  elevation_gain_m: elevation,
});

describe("weekly series", () => {
  it("weeklyKm fills weeks without runs with 0 and leaves the current week out", () => {
    const km = weeklyKm([run("2026-09-30", 5, 30), run("2026-10-14", 7, 40), run("2026-10-20", 9, 50)], TODAY);
    expect([...km]).toEqual([
      ["2026-09-28", 5],
      ["2026-10-05", 0],
      ["2026-10-12", 7],
    ]);
  });

  it("weeklyStepsMean needs 4 days of data and never counts missing days as 0", () => {
    const steps = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"].map((date) => ({ date, value: 8000 }));
    steps.push({ date: "2026-10-05", value: 1 }); // only one day in that week
    const m = weeklyStepsMean(steps, TODAY);
    expect(m.get("2026-10-12")).toBe(8000);
    expect(m.has("2026-10-05")).toBe(false);
  });

  it("weeklyWeightChange follows a steady loss and skips weeks with fewer than 2 weigh-ins", () => {
    const weights = Array.from({ length: 56 }, (_, i) => ({ date: day(i), value: 90 - 0.1 * i }));
    const weeks = weeklyWeightChange(weights, "2026-06-15");
    const lastWeek = weeks[weeks.length - 1];
    expect(lastWeek.change_kg).toBeLessThan(-0.55);
    expect(lastWeek.change_kg).toBeGreaterThan(-0.8);
    expect(weeklyWeightChange([{ date: "2026-10-13", value: 80 }], TODAY)).toEqual([]);
  });
});

describe("strength windows (frequency and volume vs progress)", () => {
  // Chest press once a week for 28 weeks, +1 % e1RM per week, 4 working sets each time.
  const press = Array.from({ length: 28 }, (_, w) => session(day(7 * w + 1), "Press banca", "Pecho", 100 * 1.01 ** w));

  it("measures frequency, weekly sets and the e1RM gain of each 4-week window", () => {
    const windows = strengthWindows(data({ sessions: press }));
    expect(windows.length).toBeGreaterThanOrEqual(4);
    for (const w of windows) {
      expect(w).toMatchObject({ exercise: "Press banca", group: "Pecho", frequency: 1, sets: 4 });
      expect(w.gain_pct_week).toBeGreaterThan(0.6);
      expect(w.gain_pct_week).toBeLessThan(1.2);
    }
  });

  it("builds the frequency scatter without a coefficient while there are fewer than 30 pairs", () => {
    const c = crossFrequencyProgress(strengthWindows(data({ sessions: press })));
    expect(c.points.length).toBeLessThan(30);
    expect(c.relation).toMatchObject({ enough: false, rho: null });
    expect(c.survives).toBe(false);
  });

  it("bins progress by weekly volume", () => {
    const bins = volumeBins(strengthWindows(data({ sessions: press })));
    expect(bins.find((b) => b.label === "0–5")!.n).toBeGreaterThan(0);
    expect(bins.find((b) => b.label === "21+")).toMatchObject({ n: 0, median_gain: null });
  });
});

describe("relativeStrength", () => {
  it("divides the e1RM by the body weight EWMA", () => {
    const sessions = Array.from({ length: 6 }, (_, w) => session(day(7 * w), "Sentadilla", "Cuádriceps", 120));
    const weights = Array.from({ length: 50 }, (_, i) => ({ date: day(i), value: 80 }));
    const [rs] = relativeStrength(data({ sessions, weights }));
    expect(rs.exercise).toBe("Sentadilla");
    expect(rs.points[0].value).toBeCloseTo(1.5, 3);
    expect(rs.change_pct).toBeCloseTo(0, 1);
  });

  it("skips exercises with fewer than 4 sessions", () => {
    const sessions = [0, 7, 14].map((n) => session(day(n), "Sentadilla", "Cuádriceps", 120));
    expect(relativeStrength(data({ sessions, weights: [{ date: day(0), value: 80 }] }))).toEqual([]);
  });
});

describe("legsWeightBox", () => {
  it("compares the day's weight with the previous EWMA by leg volume of the two days before", () => {
    // Weight 80 every day, but 81 the morning after a leg day (6 sets of legs).
    const weights: { date: string; value: number }[] = [];
    const sessions: InsightSession[] = [];
    for (let i = 0; i < 70; i++) {
      const legDay = i % 7 === 0;
      if (legDay) sessions.push(session(day(i), "Prensa", "Cuádriceps", 150, { sets: 6 }));
      weights.push({ date: day(i), value: i % 7 === 1 ? 81 : 80 });
    }
    const box = legsWeightBox(data({ weights, sessions }));
    const heavy = box.levels.find((l) => l.level === "6–11 series")!;
    const none = box.levels.find((l) => l.level === "0 series")!;
    // The level mixes the morning after (≈ +0.8) and the second day (≈ −0.1), so the median sits in between.
    expect(heavy.median!).toBeGreaterThan(none.median! + 0.3);
    expect(Math.abs(none.median!)).toBeLessThan(0.3);
    expect(box.enough).toBe(true);
  });
});

describe("positionAnalysis", () => {
  it("compares each exercise with its own mean, by position in the workout", () => {
    // Bench is done first (e1RM 110) or last (90) on alternating days: the mean is 100.
    const sessions: InsightSession[] = [];
    for (let i = 0; i < 40; i++) sessions.push(session(day(i), "Press banca", "Pecho", i % 2 ? 90 : 110, { position: i % 2 ? 3 : 0 }));
    const p = positionAnalysis(data({ sessions }));
    expect(p.enough).toBe(true);
    expect(p.buckets[0].mean_pct).toBeCloseTo(110, 0);
    expect(p.buckets[3].mean_pct).toBeCloseTo(90, 0);
  });
});

describe("quadrantOf", () => {
  it.each([
    [0.3, 0.5, "ambos_suben"],
    [0.3, 0, "peso_sube_fuerza_no"],
    [-0.2, 0.4, "fuerza_sube_peso_no"],
    [0.05, 0.05, "ninguno_sube"],
  ])("weight %s kg/wk, strength %s %%/wk → %s", (w, s, q) => {
    expect(quadrantOf(w, s)).toBe(q);
  });
});

describe("routineAdherence", () => {
  it("counts weeks done and the usual weekday, and flags routines that keep dropping out", () => {
    const sessions: InsightSession[] = [];
    for (let w = 0; w < 10; w++) {
      sessions.push(session(addDays("2026-08-10", 7 * w), "Press", "Pecho", 100, { routine: "Push" })); // Mondays
      if (w % 4 === 0) sessions.push(session(addDays("2026-08-12", 7 * w), "Remo", "Espalda", 100, { routine: "Pull" })); // Wednesdays
    }
    const r = routineAdherence(data({ sessions }));
    const push = r.find((x) => x.routine === "Push")!;
    const pull = r.find((x) => x.routine === "Pull")!;
    expect(push).toMatchObject({ weeks_done: 10, usual_weekday: 0, often_missed: false });
    expect(pull.usual_weekday).toBe(2);
    expect(pull.often_missed).toBe(true);
  });
});

describe("chart helpers", () => {
  it("volumeCalendar lays out a Monday-first grid and colours days by tonnage quartile", () => {
    const sessions = [
      session("2026-10-01", "A", "Pecho", 100, { sets: 1 }),
      session("2026-10-02", "A", "Pecho", 100, { sets: 2 }),
      session("2026-10-05", "A", "Pecho", 100, { sets: 3 }),
      session("2026-10-06", "A", "Pecho", 100, { sets: 4 }),
    ];
    const cal = volumeCalendar(sessions, TODAY, 2);
    expect(cal.map((m) => m.month)).toEqual(["2026-09", "2026-10"]);
    const oct = cal[1];
    expect(oct.offset).toBe(3); // 1 Oct 2026 is a Thursday
    expect(oct.days).toHaveLength(31);
    expect(oct.days[0].level).toBe(1);
    expect(oct.days[5].level).toBe(4);
    expect(oct.days[2].level).toBe(0);
    expect(oct.days[0].routines).toEqual(["Día A"]);
  });

  it("repDistribution buckets working sets only", () => {
    const s: InsightSession = {
      ...session("2026-10-20", "A", "Pecho", 100),
      sets: [
        { weight_kg: 50, reps: 5, is_warmup: false },
        { weight_kg: 40, reps: 12, is_warmup: false },
        { weight_kg: 40, reps: 20, is_warmup: false },
        { weight_kg: 20, reps: 10, is_warmup: true },
      ],
    };
    expect(repDistribution([s], TODAY)).toEqual([{ group: "Pecho", total: 3, counts: [1, 0, 1, 1] }]);
  });

  it("weeklyPace is Σtime/Σdistance, per surface", () => {
    const p = weeklyPace([run("2026-10-12", 10, 50, "outdoor", 40), run("2026-10-14", 5, 35, "outdoor", 10), run("2026-10-13", 5, 25, "treadmill")]);
    const outdoor = p.find((x) => x.surface === "outdoor")!;
    expect(outdoor.pace).toBe(340); // 85 min / 15 km = 5:40, not the mean of 5:00 and 7:00
    expect(outdoor.elevation_m).toBe(50);
    expect(p.find((x) => x.surface === "treadmill")!.pace).toBe(300);
  });

  it("weekdayProfile ignores missing days and counts the goal share", () => {
    const steps = [
      { date: "2026-10-12", value: 12000 }, // Monday
      { date: "2026-10-19", value: 6000 }, // Monday
      { date: "2026-10-17", value: 4000 }, // Saturday
    ];
    const [mon, , , , , sat, sun] = weekdayProfile(steps, 10_000);
    expect(mon).toMatchObject({ weekday: "Lunes", n: 2, mean: 9000, above_goal: 0.5 });
    expect(sat.median).toBe(4000);
    expect(sun).toMatchObject({ n: 0, mean: null, above_goal: null });
  });

  it("hourOfDay averages the tonnage of each workout by start hour", () => {
    const sessions = [
      session("2026-10-01", "A", "Pecho", 100, { sets: 1, time: "07:30" }),
      session("2026-10-02", "A", "Pecho", 100, { sets: 3, time: "19:15" }),
      session("2026-10-03", "A", "Pecho", 100, { sets: 1, time: "19:45" }),
    ];
    const buckets = hourOfDay(sessions);
    expect(buckets.find((b) => b.label === "Antes de las 9")!.n).toBe(1);
    const evening = buckets.find((b) => b.label === "16–20")!;
    expect(evening.n).toBe(2);
    expect(evening.mean_tonnage).toBe(Math.round((session("", "", null, 100, { sets: 3 }).sets.reduce((t, s) => t + s.weight_kg * 5, 0) + session("", "", null, 100, { sets: 1 }).sets[0].weight_kg * 5) / 2));
  });
});

describe("buildAlerts", () => {
  it("flags a 30 % drop in steps against the previous 4 weeks", () => {
    const steps = [
      ...Array.from({ length: 28 }, (_, i) => ({ date: addDays(TODAY, -34 + i), value: 10000 })),
      ...Array.from({ length: 7 }, (_, i) => ({ date: addDays(TODAY, -6 + i), value: 6000 })),
    ];
    const a = buildAlerts(data({ steps }));
    expect(a.find((x) => x.id === "pasos")!.text).toMatch(/40 %/);
  });

  it("stays quiet with little step data", () => {
    expect(buildAlerts(data({ steps: [{ date: TODAY, value: 100 }] }))).toEqual([]);
  });

  it("compares last week's km with the mean and mentions the weight change", () => {
    const runs = [run("2026-09-16", 10, 60), run("2026-09-23", 10, 60), run("2026-09-30", 10, 60), run("2026-10-07", 10, 60), run("2026-10-13", 20, 120)];
    const weights = Array.from({ length: 40 }, (_, i) => ({ date: addDays("2026-09-12", i), value: 85 - 0.1 * i }));
    const a = buildAlerts(data({ runs, weights })).find((x) => x.id === "km-peso")!;
    expect(a.text).toMatch(/10 km más que tu media/);
    expect(a.text).toMatch(/bajó/);
    expect(a.text).toMatch(/no causa/);
  });

  it("suggests a deload after 3 high-volume weeks with no new e1RM best", () => {
    const sessions: InsightSession[] = [];
    for (let w = 0; w < 7; w++) {
      const heavy = w >= 4; // the last 3 complete weeks (Oct 5, 12... see below) carry more sets
      for (const ex of ["Press banca", "Remo"]) {
        sessions.push(session(addDays("2026-09-14", 7 * w + 1), ex, ex === "Press banca" ? "Pecho" : "Espalda", 100, { sets: heavy ? 8 : 4 }));
        if (heavy) sessions.push(session(addDays("2026-09-14", 7 * w + 3), ex, ex === "Press banca" ? "Pecho" : "Espalda", 100, { sets: 8 }));
      }
    }
    expect(buildAlerts(data({ sessions })).map((x) => x.id)).toContain("descarga");
    // The same weeks with a new best in one exercise: no alert.
    const pr = sessions.map((s) => (s.exercise === "Press banca" && s.date >= "2026-10-06" ? { ...s, sets: s.sets.map((x) => ({ ...x, weight_kg: x.weight_kg * 1.1 })) } : s));
    expect(buildAlerts(data({ sessions: pr })).map((x) => x.id)).not.toContain("descarga");
  });
});

describe("monthlyReport", () => {
  it("clamps the current month to today", () => {
    expect(monthBounds("2026-10", TODAY)).toEqual({ from: "2026-10-01", to: TODAY });
    expect(monthBounds("2026-09", TODAY)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("summarises weight, steps, runs, volume, new records, stalled exercises and neglected muscles", () => {
    const sessions: InsightSession[] = [];
    // Press: flat for 8 weeks (stalled), Squat gets a PR on 2026-10-06.
    for (let w = 0; w < 8; w++) sessions.push(session(addDays("2026-08-31", 7 * w), "Press banca", "Pecho", 100, { sets: 10 }));
    for (let w = 0; w < 5; w++) sessions.push(session(addDays("2026-09-08", 7 * w), "Sentadilla", "Cuádriceps", w === 4 ? 140 : 120, { sets: 12 }));
    for (const d of ["2026-10-13", "2026-10-20"]) sessions.push(session(d, "Sentadilla", "Cuádriceps", 120, { sets: 14 }));
    const weights = Array.from({ length: 60 }, (_, i) => ({ date: addDays("2026-08-25", i), value: 85 - 0.05 * i }));
    const steps = Array.from({ length: 10 }, (_, i) => ({ date: addDays("2026-10-01", i), value: 9000 }));
    const runs = [run("2026-10-03", 5, 30), run("2026-10-10", 5, 30)];
    const r = monthlyReport(data({ sessions, weights, steps, runs }), "2026-10", []);

    expect(r.weight!.change).toBeLessThan(0);
    expect(r.steps).toEqual({ mean: 9000, days: 10 });
    expect(r.runs).toEqual({ count: 2, km: 10, pace_s_per_km: 360 });
    expect(r.workouts.count).toBe(6);
    expect(r.prs).toContainEqual(expect.objectContaining({ exercise: "Sentadilla", kind: "e1rm", date: "2026-10-06" }));
    expect(r.stalled).toEqual(["Press banca"]);
    expect(r.neglected.map((g) => g.group)).toContain("Espalda");
    expect(r.neglected.map((g) => g.group)).not.toContain("Cuádriceps");
    expect(r.relations_pending).toBe(true);
  });

  it("reports only the strongest relations that survived the correction", () => {
    const cross = (id: string, rho: number, survives: boolean) =>
      ({
        id,
        title: id,
        question: "",
        xLabel: "",
        yLabel: "",
        xUnit: "",
        yUnit: "",
        points: [],
        lag: { weeks: 1, tried: 3 },
        survives,
        caveat: "",
        relation: { n: 40, rho, ci95: [rho - 0.1, rho + 0.1] as [number, number], p: 0.001, enough: true },
      });
    const r = monthlyReport(data(), "2026-10", [cross("a", 0.3, true), cross("b", -0.7, true), cross("c", 0.9, false), cross("d", 0.5, true)]);
    expect(r.relations.map((x) => x.id)).toEqual(["b", "d", "a"]);
    expect(r.relations_pending).toBe(false);
  });
});

describe("applyFdr", () => {
  it("marks only the relations that survive the multiple-comparison correction", () => {
    const rel = (p: number | null) => ({ relation: { n: 40, rho: 0.5, ci95: null, p, enough: p !== null }, survives: false });
    expect(applyFdr([rel(0.001), rel(0.04), rel(0.3), rel(null)]).map((c) => c.survives)).toEqual([true, false, false, false]);
  });
});
