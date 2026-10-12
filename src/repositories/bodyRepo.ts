import "server-only";
import { and, asc, desc, gte, isNotNull, lte, max, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { bodyLog } from "@/db/schema";
import type { BodyEntry, BodyRow } from "@/domain/schemas/body";
import { toNum, type DateRange } from "./types";

export interface BodyRepo {
  list(range?: DateRange): Promise<BodyRow[]>;
  /** Upsert by date; fields left undefined keep their stored value. */
  upsert(entry: BodyEntry): Promise<void>;
  remove(date: string): Promise<void>;
  /** Scale names ever used, most recently used first. */
  scales(): Promise<string[]>;
}

export const bodyRepo: BodyRepo = {
  async list(range = {}) {
    const rows = await getDb()
      .select()
      .from(bodyLog)
      .where(
        and(
          range.from ? gte(bodyLog.date, range.from) : undefined,
          range.to ? lte(bodyLog.date, range.to) : undefined,
        ),
      )
      .orderBy(asc(bodyLog.date));
    return rows.map((r) => ({ date: r.date, weight_kg: toNum(r.weightKg), steps: r.steps, scale: r.scale }));
  },

  async upsert(e) {
    const weight = e.weight_kg !== undefined ? String(e.weight_kg) : null;
    const steps = e.steps ?? null;
    // The scale belongs to the weigh-in: it is replaced only together with the weight.
    const scale = e.weight_kg !== undefined ? (e.scale ?? null) : null;
    await getDb()
      .insert(bodyLog)
      .values({ date: e.date, weightKg: weight, steps, scale })
      .onConflictDoUpdate({
        target: bodyLog.date,
        set: {
          weightKg: e.weight_kg !== undefined ? weight : sql`${bodyLog.weightKg}`,
          steps: e.steps !== undefined ? steps : sql`${bodyLog.steps}`,
          scale: e.weight_kg !== undefined ? scale : sql`${bodyLog.scale}`,
          updatedAt: sql`now()`,
        },
      });
  },

  async remove(date) {
    await getDb().delete(bodyLog).where(sql`${bodyLog.date} = ${date}`);
  },

  async scales() {
    const rows = await getDb()
      .select({ scale: bodyLog.scale, last: max(bodyLog.date) })
      .from(bodyLog)
      .where(isNotNull(bodyLog.scale))
      .groupBy(bodyLog.scale)
      .orderBy(desc(max(bodyLog.date)));
    return rows.map((r) => r.scale!);
  },
};
