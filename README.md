# GymWeb

A personal web app for logging **weight and steps, runs, nutrition (daily totals) and strength training** (pasted from Lyfta), with progression statistics that are done correctly.

**➡ Deploying / database: see [SETUP.md](SETUP.md).** Original design plan: [docs/PLAN.md](docs/PLAN.md).

## Stack

Next.js 16 (App Router) + TypeScript · Neon Postgres (`@neondatabase/serverless`, HTTP) · Drizzle ORM · Zod · Tailwind CSS v4 · Recharts · Vitest · Vercel.

## Structure

```
src/
  domain/          pure logic, no I/O (unit-tested)
    schemas/       Zod schemas = source of truth for types
    lyfta/         parseLyfta(): Lyfta text export → workout + warnings + checksums
    stats/         e1RM, EWMA (gap-aware), OLS + t CI, Theil-Sen + bootstrap CI,
                   weighted pace, PRs, ISO weeks, weekly volume, body/strength trends
  repositories/    the only layer that talks to the database (Drizzle)
  services/        compose repositories + domain (dashboard uses body + runs only)
  app/             pages (Dashboard, Entrenos, Carrera, Nutrición, Importar, Datos) + /api routes
  components/      UI (gymlife-based dark theme, light mode optional)
  proxy.ts         single-user session check (HMAC-signed cookie)
drizzle/           SQL migrations (applied automatically on build)
tests/             parser, statistics and architecture tests
```

## Statistics (summary)

- **e1RM**: mean of Epley and Brzycki on working sets with 1–10 reps. One observation per session = its best set.
- **Strength trend**: EWMA (α 0.3/week, gap-adjusted), plus a Theil-Sen slope in kg/week over 12 weeks (≥4 sessions) with a 95 % bootstrap CI. It says "mejora/empeora" only when the CI excludes 0. OLS is shown alongside as a cross-check. A jump between sessions counts as "real" when it exceeds 1.5 × the typical error.
- **Body weight**: EWMA α 0.1/day (Hacker's Diet style), a 7-day mean (needs ≥4 weigh-ins) and an OLS slope over 28 days with a 95 % CI. The ↑/↓ arrow appears only when the CI excludes 0 and |slope| > 0.1 kg/week. Days without a weigh-in are never filled in.
- **Pace**: Σtime / Σdistance, never the mean of paces. Treadmill and outdoor runs are kept apart, and comparisons use only similar runs (same surface, distance ±20 %).

## Scripts

```bash
npm run dev          # local dev server
npm test             # vitest
npm run lint && npm run typecheck
npm run db:generate  # new migration after editing src/db/schema.ts
npm run db:migrate   # apply migrations (also runs inside `npm run build`)
```
