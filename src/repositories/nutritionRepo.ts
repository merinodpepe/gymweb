import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { nutritionLog } from "@/db/schema";
import type { NutritionEntry } from "@/domain/schemas/nutrition";
import type { DateRange } from "./types";

export interface NutritionRepo {
  list(range?: DateRange): Promise<NutritionEntry[]>;
  upsert(entry: NutritionEntry): Promise<void>;
  remove(date: string): Promise<void>;
}

export const nutritionRepo: NutritionRepo = {
  async list(range = {}) {
    const rows = await getDb()
      .select()
      .from(nutritionLog)
      .where(
        and(
          range.from ? gte(nutritionLog.date, range.from) : undefined,
          range.to ? lte(nutritionLog.date, range.to) : undefined,
        ),
      )
      .orderBy(asc(nutritionLog.date));
    return rows.map((r) => ({
      date: r.date,
      kcal: r.kcal,
      protein_g: Number(r.proteinG),
      carbs_g: Number(r.carbsG),
      fiber_g: Number(r.fiberG),
    }));
  },
  async upsert(e) {
    const values = {
      date: e.date,
      kcal: e.kcal,
      proteinG: String(e.protein_g),
      carbsG: String(e.carbs_g),
      fiberG: String(e.fiber_g),
    };
    await getDb()
      .insert(nutritionLog)
      .values(values)
      .onConflictDoUpdate({ target: nutritionLog.date, set: values });
  },
  async remove(date) {
    await getDb().delete(nutritionLog).where(eq(nutritionLog.date, date));
  },
};
