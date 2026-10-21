import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { googleAuth } from "@/db/schema";
import { open, seal } from "@/lib/secret-box";

export interface GoogleConnection {
  refreshToken: string;
  scope: string;
  connectedAt: Date;
  lastSyncAt: Date | null;
}

export const googleAuthRepo = {
  async get(): Promise<GoogleConnection | null> {
    const [r] = await getDb().select().from(googleAuth).where(eq(googleAuth.id, 1));
    return r
      ? { refreshToken: open(r.refreshTokenSealed), scope: r.scope, connectedAt: r.connectedAt, lastSyncAt: r.lastSyncAt }
      : null;
  },

  async save(refreshToken: string, scope: string): Promise<void> {
    const refreshTokenSealed = seal(refreshToken);
    await getDb()
      .insert(googleAuth)
      .values({ id: 1, refreshTokenSealed, scope })
      .onConflictDoUpdate({ target: googleAuth.id, set: { refreshTokenSealed, scope, connectedAt: sql`now()` } });
  },

  async touchSync(): Promise<void> {
    await getDb().update(googleAuth).set({ lastSyncAt: sql`now()` }).where(eq(googleAuth.id, 1));
  },

  async remove(): Promise<void> {
    await getDb().delete(googleAuth).where(eq(googleAuth.id, 1));
  },
};
