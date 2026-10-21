import { describe, expect, it } from "vitest";
import { consistency } from "@/domain/stats/consistency";
import { detectPlateau } from "@/domain/stats/plateau";

describe("consistency", () => {
  it("counts weekly streaks and tolerates an empty current week", () => {
    // today = Wed 2025-10-15; weeks of Sep 22, Sep 29, Oct 6 have workouts, this week none yet.
    const c = consistency(
      ["2025-09-22", "2025-09-23", "2025-09-25", "2025-09-29", "2025-10-01", "2025-10-03", "2025-10-06", "2025-10-07", "2025-10-09"],
      "2025-10-15",
    );
    expect(c.current_streak).toBe(3);
    expect(c.longest_streak).toBe(3);
    expect(c.workouts_this_week).toBe(0);
    expect(c.target_this_week).toBe(3);
    expect(c.total_workouts).toBe(9);
    // weeks Sep 22, Sep 29, Oct 6 are 100%; the empty current week is not scored yet.
    expect(c.score).toBe(100);
    expect(c.heatmap).toHaveLength(26);
    expect(c.heatmap.at(-1)!.week_start).toBe("2025-10-13");
  });
  it("breaks the streak after a missed week", () => {
    const wk = (m: string) => [m, m.slice(0, 8) + String(+m.slice(8) + 1).padStart(2, "0"), m.slice(0, 8) + String(+m.slice(8) + 2).padStart(2, "0")];
    const c = consistency([...wk("2025-09-01"), ...wk("2025-09-08"), ...wk("2025-10-13")], "2025-10-15");
    expect(c.current_streak).toBe(1);
    expect(c.longest_streak).toBe(2);
  });
  it("averages partial weeks", () => {
    // week Oct 6 = 3/3, week Oct 13 (current, incomplete) ignored, week Sep 29 = 1/3 -> (33 + 100) / 2
    const c = consistency(["2025-09-30", "2025-10-06", "2025-10-07", "2025-10-08", "2025-10-13"], "2025-10-15");
    expect(c.score).toBe(67);
  });
  it("needs 3 workouts, not just one", () => {
    expect(consistency(["2025-10-13", "2025-10-14"], "2025-10-15").current_streak).toBe(0);
  });
  it("raises the target to 4 from 2026-10-19", () => {
    const three = ["2026-10-19", "2026-10-20", "2026-10-21"];
    expect(consistency(three, "2026-10-21")).toMatchObject({ target_this_week: 4, current_streak: 0 });
    expect(consistency([...three, "2026-10-22"], "2026-10-22").current_streak).toBe(1);
    expect(consistency(["2026-10-12", "2026-10-13", "2026-10-14"], "2026-10-21").current_streak).toBe(1);
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
