import "server-only";
import { and, asc, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { bodyLog } from "@/db/schema";
import type { BodyEntry, BodyRow } from "@/domain/schemas/body";
import { toNum, type DateRange } from "./types";

export interface BodyRepo {
  list(range?: DateRange): Promise<BodyRow[]>;
  /** Upsert by date; fields left undefined keep their stored value. */
  upsert(entry: BodyEntry): Promise<void>;
  remove(date: string): Promise<void>;
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
    return rows.map((r) => ({ date: r.date, weight_kg: toNum(r.weightKg), steps: r.steps }));
  },

  async upsert(e) {
    const weight = e.weight_kg !== undefined ? String(e.weight_kg) : null;
    const steps = e.steps ?? null;
    await getDb()
      .insert(bodyLog)
      .values({ date: e.date, weightKg: weight, steps })
      .onConflictDoUpdate({
        target: bodyLog.date,
        set: {
          weightKg: e.weight_kg !== undefined ? weight : sql`${bodyLog.weightKg}`,
          steps: e.steps !== undefined ? steps : sql`${bodyLog.steps}`,
          updatedAt: sql`now()`,
        },
      });
  },

  async remove(date) {
    await getDb().delete(bodyLog).where(sql`${bodyLog.date} = ${date}`);
  },
};
