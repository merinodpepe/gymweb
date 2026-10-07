// Applies pending Drizzle migrations. Runs before `next build` on Vercel so a
// fresh Neon database gets its tables automatically. Skips when no URL is set.
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.warn("[migrate] DATABASE_URL not set: skipping migrations.");
  process.exit(0);
}
neonConfig.fetchEndpoint = (host) =>
  host === "db.localtest.me" ? `http://${host}:4444/sql` : `https://${host}/sql`;
await migrate(drizzle(neon(url)), { migrationsFolder: "./drizzle" });
console.log("[migrate] database is up to date.");
