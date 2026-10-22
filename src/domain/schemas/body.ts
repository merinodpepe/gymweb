import { z } from "zod";
import { IsoDate, num } from "./common";

export const BodySchema = z
  .object({
    date: IsoDate,
    weight_kg: num().pipe(z.number().min(20).max(400)).optional(),
    steps: num().pipe(z.number().int().min(0).max(200_000)).optional(),
    /** Scale used for this weigh-in (free text: "Casa", "Gimnasio"…). */
    scale: z.string().trim().max(40).optional().transform((s) => s || undefined),
    /** How you felt that day, 1 (drained) to 10 (great). */
    energy: num().pipe(z.number().int().min(1).max(10)).optional(),
    waist_cm: num().pipe(z.number().min(30).max(250)).optional(),
    arm_cm: num().pipe(z.number().min(10).max(100)).optional(),
  })
  .refine((b) => [b.weight_kg, b.steps, b.energy, b.waist_cm, b.arm_cm].some((v) => v !== undefined), {
    message: "Indica peso, pasos, energía o alguna medida",
  });

export type BodyEntry = z.infer<typeof BodySchema>;

export type BodyRow = {
  date: string;
  weight_kg: number | null;
  steps: number | null;
  scale: string | null;
  energy: number | null;
  waist_cm: number | null;
  arm_cm: number | null;
};
