import { describe, expect, it } from "vitest";
import { consistency } from "@/domain/stats/consistency";
import { detectPlateau } from "@/domain/stats/plateau";

describe("consistency", () => {
  it("counts weekly streaks and tolerates an empty current week", () => {
    // today = Wed 2025-10-15; weeks of Sep 22, Sep 29, Oct 6 have workouts, this week none yet.
    const c = consistency(["2025-09-23T18:00", "2025-09-25T18:00", "2025-10-01T10:00", "2025-10-07T10:00"], "2025-10-15");
    expect(c.current_streak).toBe(3);
    expect(c.longest_streak).toBe(3);
    expect(c.workouts_this_week).toBe(0);
    expect(c.total_workouts).toBe(4);
    expect(c.score).toBe(Math.round((3 / 4) * 100));
    expect(c.heatmap).toHaveLength(26);
    expect(c.heatmap.at(-1)!.week_start).toBe("2025-10-13");
  });
  it("breaks the streak after a missed week", () => {
    const c = consistency(["2025-09-01", "2025-09-08", "2025-10-13"], "2025-10-15");
    expect(c.current_streak).toBe(1);
    expect(c.longest_streak).toBe(2);
  });
  it("handles no data", () => {
    expect(consistency([], "2025-10-15")).toMatchObject({ current_streak: 0, score: 0, avg_per_week: 0 });
  });
});

describe("plateau", () => {
  const pts = (vals: number[]) => vals.map((value, i) => ({ date: `2025-0${1 + Math.floor(i / 4)}-${String(1 + (i % 4) * 7).padStart(2, "0")}`, value }));
  it("flags a stall", () => {
    expect(detectPlateau(pts([100, 110, 110, 110.5, 110, 109, 110]), "flat").status).toBe("estancado");
  });
  it("keeps improving lifts out", () => {
    expect(detectPlateau(pts([100, 102, 104, 106, 108]), "up").status).toBe("mejorando");
  });
  it("does not call a lift 'mejorando' without evidence", () => {
    expect(detectPlateau(pts([100, 110, 108, 109, 110]), "flat").status).toBe("estable");
    expect(detectPlateau(pts([100, 101, 100, 101, 112]), "flat").status).toBe("mejorando");
  });
  it("needs data", () => {
    expect(detectPlateau(pts([100, 101]), null).status).toBe("pocos_datos");
  });
});
