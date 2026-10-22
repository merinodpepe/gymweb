import { z } from "zod";
import { IsoDate, num } from "./common";

export const Surface = z.enum(["treadmill", "outdoor"]);
export type Surface = z.infer<typeof Surface>;

export const RunSchema = z.object({
  date: IsoDate,
  distance_km: num().pipe(z.number().positive().max(500)),
  duration_s: num().pipe(z.number().int().positive().max(7 * 24 * 3600)),
  elevation_gain_m: num().pipe(z.number().int().min(0)).optional().default(0),
  surface: Surface,
  /** Perceived effort, 1 (very easy) to 10 (maximal); optional. */
  effort: num().pipe(z.number().int().min(1).max(10)).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export type RunInput = z.infer<typeof RunSchema>;
export type RunRow = Omit<RunInput, "effort"> & { id: string; notes: string | null; effort: number | null };
