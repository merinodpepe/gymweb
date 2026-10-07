import { z } from "zod";
import { IsoDate, num } from "./common";

export const NutritionSchema = z.object({
  date: IsoDate,
  kcal: num().pipe(z.number().int().min(0).max(20_000)),
  protein_g: num().pipe(z.number().min(0).max(2000)),
  carbs_g: num().pipe(z.number().min(0).max(4000)),
  fiber_g: num().pipe(z.number().min(0).max(500)),
});

export type NutritionEntry = z.infer<typeof NutritionSchema>;
