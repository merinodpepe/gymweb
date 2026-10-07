import "server-only";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { MissingDatabaseError } from "@/lib/errors";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema>;

let db: Db | null = null;

// Local development (docker-compose.yml): route db.localtest.me to the HTTP proxy.
neonConfig.fetchEndpoint = (host) =>
  host === "db.localtest.me" ? `http://${host}:4444/sql` : `https://${host}/sql`;

export { MissingDatabaseError };

/** Lazily creates the Neon HTTP client (no socket to keep alive between requests). */
export function getDb(): Db {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new MissingDatabaseError();
  db = drizzle(neon(url), { schema });
  return db;
}
