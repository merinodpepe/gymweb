import "server-only";
import type { NutritionEntry } from "@/domain/schemas/nutrition";
import { mean } from "@/domain/stats/util";
import { isoWeekStart } from "@/domain/stats/weeks";
import { nutritionRepo } from "@/repositories/nutritionRepo";
import { parseRange } from "./range";

export interface NutritionWeek {
  week_start: string;
  partial: boolean;
  days: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fiber_g: number;
}

/** Weekly means over the days that were logged (unlogged days are not zeros). */
export function weeklyNutrition(rows: readonly NutritionEntry[], today: string): NutritionWeek[] {
  const map = new Map<string, NutritionEntry[]>();
  for (const r of rows) {
    const wk = isoWeekStart(r.date);
    map.set(wk, [...(map.get(wk) ?? []), r]);
  }
  const current = isoWeekStart(today);
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week_start, list]) => ({
      week_start,
      partial: week_start === current,
      days: list.length,
      kcal: mean(list.map((x) => x.kcal)),
      protein_g: mean(list.map((x) => x.protein_g)),
      carbs_g: mean(list.map((x) => x.carbs_g)),
      fiber_g: mean(list.map((x) => x.fiber_g)),
    }));
}

export async function getNutrition(range = "90d") {
  const { today, from } = parseRange(range);
  const rows = await nutritionRepo.list({ from, to: today });
  return { today, rows, weeks: weeklyNutrition(rows, today) };
}
