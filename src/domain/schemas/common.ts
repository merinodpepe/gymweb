import { z } from "zod";

/** Calendar date as `YYYY-MM-DD` (no time zone: the day the user lived). */
export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha con formato AAAA-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Fecha no válida");

/** Local wall-clock date-time as `YYYY-MM-DDTHH:mm` (as shown by Lyfta). */
export const LocalDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha y hora con formato AAAA-MM-DDTHH:mm");

/** Accepts numbers or numeric strings (form inputs), with comma decimals. */
export const num = () =>
  z.preprocess((v) => {
    if (typeof v === "string") {
      const t = v.trim().replace(",", ".");
      return t === "" ? undefined : Number(t);
    }
    return v === null ? undefined : v;
  }, z.number().finite());
