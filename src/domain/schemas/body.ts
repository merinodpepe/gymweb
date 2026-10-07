import { z } from "zod";
import { IsoDate, num } from "./common";

export const BodySchema = z
  .object({
    date: IsoDate,
    weight_kg: num().pipe(z.number().min(20).max(400)).optional(),
    steps: num().pipe(z.number().int().min(0).max(200_000)).optional(),
  })
  .refine((b) => b.weight_kg !== undefined || b.steps !== undefined, {
    message: "Indica peso o pasos",
  });

export type BodyEntry = z.infer<typeof BodySchema>;

export type BodyRow = { date: string; weight_kg: number | null; steps: number | null };
