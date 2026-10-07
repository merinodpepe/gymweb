import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { runs } from "@/db/schema";
import type { RunInput, RunRow } from "@/domain/schemas/run";
import type { DateRange } from "./types";

export interface RunRepo {
  list(range?: DateRange): Promise<RunRow[]>;
  create(run: RunInput): Promise<RunRow>;
  update(id: string, run: RunInput): Promise<RunRow | null>;
  remove(id: string): Promise<void>;
}

type DbRun = typeof runs.$inferSelect;
const toRow = (r: DbRun): RunRow => ({
  id: r.id,
  date: r.date,
  distance_km: Number(r.distanceKm),
  duration_s: r.durationS,
  elevation_gain_m: r.elevationGainM,
  surface: r.surface,
  notes: r.notes,
});
const toDb = (r: RunInput) => ({
  date: r.date,
  distanceKm: String(r.distance_km),
  durationS: r.duration_s,
  elevationGainM: r.elevation_gain_m ?? 0,
  surface: r.surface,
  notes: r.notes || null,
});

export const runRepo: RunRepo = {
  async list(range = {}) {
    const rows = await getDb()
      .select()
      .from(runs)
      .where(
        and(range.from ? gte(runs.date, range.from) : undefined, range.to ? lte(runs.date, range.to) : undefined),
      )
      .orderBy(asc(runs.date));
    return rows.map(toRow);
  },
  async create(run) {
    const [row] = await getDb().insert(runs).values(toDb(run)).returning();
    return toRow(row);
  },
  async update(id, run) {
    const [row] = await getDb().update(runs).set(toDb(run)).where(eq(runs.id, id)).returning();
    return row ? toRow(row) : null;
  },
  async remove(id) {
    await getDb().delete(runs).where(eq(runs.id, id));
  },
};
