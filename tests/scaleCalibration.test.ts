import { describe, expect, it } from "vitest";
import { calibrateScales, type WeighIn } from "@/domain/stats/scaleCalibration";
import { mulberry32 } from "@/domain/stats/util";
import { addDays } from "@/domain/stats/weeks";

const TODAY = "2026-10-12";

/** One weigh-in per day, rotating scales, true weight losing 0.5 kg/week plus noise. */
function synth(biases: Record<string, number>, days = 120, noise = 0.3, seed = 7): WeighIn[] {
  const rand = mulberry32(seed);
  const names = Object.keys(biases);
  const out: WeighIn[] = [];
  for (let d = 0; d < days; d++) {
    const date = addDays(TODAY, d - days + 1);
    const truth = 90 - (0.5 / 7) * d;
    const scale = names[d % names.length];
    out.push({ date, scale, value: truth + biases[scale] + (rand() - 0.5) * 2 * noise });
  }
  return out;
}

const offsetOf = (cal: ReturnType<typeof calibrateScales>, name: string) =>
  cal.scales.find((s) => s.scale === name)!.offset!;

describe("calibrateScales", () => {
  it("recovers the bias of two alternating scales relative to their mean", () => {
    const cal = calibrateScales(synth({ Casa: -0.25, Gimnasio: 0.25 }), TODAY);
    expect(offsetOf(cal, "Casa")).toBeCloseTo(-0.25, 1);
    expect(offsetOf(cal, "Gimnasio")).toBeCloseTo(0.25, 1);
    expect(offsetOf(cal, "Casa") + offsetOf(cal, "Gimnasio")).toBeCloseTo(0, 9);
    const gym = cal.scales.find((s) => s.scale === "Gimnasio")!;
    expect(gym.confidence).toBe("alta");
    expect(gym.ci95).toBeGreaterThan(0);
    expect(gym.ci95).toBeLessThan(0.2);
  });

  it("recovers three scales", () => {
    const cal = calibrateScales(synth({ A: 0.4, B: -0.4, C: 0 }), TODAY);
    expect(Math.abs(offsetOf(cal, "A") - 0.4)).toBeLessThan(0.1);
    expect(Math.abs(offsetOf(cal, "B") + 0.4)).toBeLessThan(0.1);
    expect(Math.abs(offsetOf(cal, "C"))).toBeLessThan(0.1);
  });

  it("corrects measurements and leaves unknown scales untouched", () => {
    const cal = calibrateScales(synth({ Casa: -0.25, Gimnasio: 0.25 }, 120, 0), TODAY);
    expect(cal.correct({ date: TODAY, value: 80, scale: "Gimnasio" })).toBeCloseTo(79.75, 2);
    expect(cal.correct({ date: TODAY, value: 80, scale: null })).toBe(80);
    expect(cal.correct({ date: TODAY, value: 80, scale: "Nueva" })).toBe(80);
  });

  it("does not calibrate a scale never used near another one", () => {
    const data: WeighIn[] = [
      ...synth({ Casa: 0, Gimnasio: 0.5 }, 60),
      { date: addDays(TODAY, -150), value: 95, scale: "Hotel" },
    ];
    const cal = calibrateScales(data, TODAY);
    const hotel = cal.scales.find((s) => s.scale === "Hotel")!;
    expect(hotel.offset).toBeNull();
    expect(hotel.confidence).toBeNull();
    expect(Math.abs(offsetOf(cal, "Gimnasio") - offsetOf(cal, "Casa") - 0.5)).toBeLessThan(0.1);
  });

  it("is the identity without scales or with a single one", () => {
    expect(calibrateScales([], TODAY).scales).toEqual([]);
    const one = calibrateScales(synth({ Casa: 0 }, 30), TODAY);
    expect(one.scales[0].offset).toBeNull();
    expect(one.correct({ date: TODAY, value: 81, scale: "Casa" })).toBe(81);
  });
});
