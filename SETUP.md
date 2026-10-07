# GymWeb: what you need to do (database + hosting)

The code is finished, tested and pushed to **https://github.com/merinodpepe/gymweb**.
Only the accounts are missing: Claude can't create those for you. It takes about **15 minutes**, with no terminal needed.

You will end up with:

| Piece | Service | Cost | Sleeps? |
|---|---|---|---|
| Web app | **Vercel** (Hobby) | Free | No: serverless, nothing to keep awake |
| Database | **Neon Postgres** (Free) | Free | Scales to zero after 5 min idle and **wakes up by itself** (~1 s) on the next visit. It is never archived or paused. |
| Backups | **GitHub Actions** | Free | Monthly encrypted `pg_dump` |

---

## Step 1: Create the Vercel project (5 min)

1. Go to **https://vercel.com/signup** and choose **Continue with GitHub** (use the `merinodpepe` account).
2. Click **Add New… → Project**.
3. Find **`gymweb`** in the list and click **Import**. (If it's not listed: *Adjust GitHub App Permissions* → give Vercel access to the `gymweb` repo.)
4. Leave every setting as detected (Framework: **Next.js**, Root Directory: `./`).
5. Open **Environment Variables** and add these two:

   | Name | Value |
   |---|---|
   | `APP_PASSWORD` | The password you'll type to log in. Pick a strong one. |
   | `SESSION_SECRET` | A long random string (at least 32 characters). Generate one at https://generate-secret.vercel.app/64 or run `openssl rand -base64 48`. |

6. Click **Deploy**. The first deploy works even without a database: the pages will show a *"Base de datos no configurada"* card. That's expected.

## Step 2: Create the database from Vercel (5 min)

This is the easiest route: Vercel creates the Neon database and sets the connection variables for you.

1. In your Vercel project, open the **Storage** tab → **Create Database** → choose **Neon** (Serverless Postgres) → **Continue**.
2. Accept the Neon terms (this creates a Neon account linked to Vercel).
3. Plan: **Free**. Region: **Frankfurt, Germany (eu-central-1)**. The app's functions are pinned to Frankfurt (`vercel.json`), so the two sit next to each other.
4. Name it `gymweb` → **Create** → **Connect** it to the `gymweb` project (keep all environments ticked).
5. Vercel now adds `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and a few `PG*` variables. Check them under **Settings → Environment Variables**.

> **Alternative (manual):** create a free project at https://neon.tech (region Frankfurt). In **Connect**, copy the *pooled* connection string and add it in Vercel as `DATABASE_URL`. Optionally also add the *direct* (unpooled) string as `DATABASE_URL_UNPOOLED`.

## Step 3: Redeploy so the tables get created (1 min)

1. **Deployments** tab → the latest deployment → **⋯** → **Redeploy**.
2. In the build log you should see: `[migrate] database is up to date.`
   The build runs the migrations automatically (`scripts/migrate.mjs`), so there's no SQL to run by hand. Every later deploy applies new migrations the same way.
3. Open your URL (e.g. `https://gymweb-xxxx.vercel.app`), type your `APP_PASSWORD`, and you're in.

## Step 4: First use

- **Dashboard → Registrar peso y pasos**: log today's weight.
- **Importar**: in Lyfta, open a workout → share → copy as text, paste it and press **Analizar**. Check the preview, then **Guardar**.
  - The preview shows *"Volumen cuadra (con/sin calentamientos)"*: this tells you how Lyfta computes volume (the open question in the plan). If it says the volume doesn't match, the workout can still be saved: it's only a warning.
  - Importing the same workout again gives *"Ya hay un entreno…"* with a **Reemplazar** button.
  - If the parser doesn't recognise your real Lyfta text (different date/header format), the warnings say which line failed. The raw text is always stored, so nothing is lost and it can be re-parsed later.
- **Datos → Alias**: map Lyfta names to one canonical name and a muscle group (e.g. *Lever Military Press → Press militar, Hombro*). This feeds the weekly sets-per-muscle table and merges history across routines.
- **Carrera** and **Nutrición** have their own forms. Nutrition is deliberately kept off the Dashboard.

## Step 5: Turn on monthly backups (3 min, recommended)

The repo is **public**, so the backup is **encrypted** before it's stored as a workflow artifact.

1. In Neon (open it from Vercel → Storage → your database → **Open in Neon**) → **Connect**. Turn **off** *Connection pooling* and copy that **direct** connection string.
2. On GitHub: **https://github.com/merinodpepe/gymweb/settings/secrets/actions** → **New repository secret**, twice:
   - `BACKUP_DATABASE_URL` = the direct connection string
   - `BACKUP_PASSPHRASE` = a long passphrase. **Save it in your password manager**: without it the backups can't be decrypted.
3. **Actions** tab → *Monthly database backup* → **Run workflow** once to check it goes green. After that it runs on the 1st of every month, and each backup is kept for 90 days.

To restore a backup (download the artifact zip from the workflow run first):

```bash
gpg -d gymweb-YYYY-MM-DD.sql.gz.gpg | gunzip | psql "<connection string of an EMPTY database>"
```

For a quick manual copy at any time: **Datos → Exportar CSV**.

---

## Good to know

- **Changing the password:** edit `APP_PASSWORD` in Vercel → redeploy. Changing `SESSION_SECRET` logs out every device.
- **Free-tier limits:** Neon Free gives 0.5 GB storage and plenty of compute hours for one person (years of data). Vercel Hobby is for personal, non-commercial use, which this is.
- **Preview deployments** (branches other than `main`) use the same database. Fine for a personal app; just don't test destructive things on a preview.
- **Cold start:** after a while without visits, the first page load takes ~1 s longer while Neon wakes up. A skeleton is shown in the meantime.
- **Time zone:** "today" is computed in `Europe/Madrid`. To change it, add the env var `APP_TIME_ZONE` (e.g. `Atlantic/Canary`).
- **Goals** on the Dashboard progress bars: optional env vars `STEPS_GOAL` (default 10000) and `WEEKLY_RUN_KM_GOAL` (default 15).
- **Template credit:** the design reuses the Colorlib *Gymlife* template's look and images. The footer keeps the credit, as its licence asks.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Base de datos no configurada" | `DATABASE_URL` is missing in Vercel → Step 2, then redeploy. |
| Build fails at `[migrate]` | The connection string is wrong or the database was deleted. Re-copy it from Neon. |
| Login says "Contraseña incorrecta" with the right password | Check `APP_PASSWORD` has no trailing spaces, then redeploy (env changes need a redeploy). |
| Server error mentioning `SESSION_SECRET` | It's missing or shorter than 32 characters. |
| "Algo ha fallado" on a page | Usually a transient wake-up hiccup: press *Reintentar*. If it persists, check Vercel → Logs. |

## Local development (optional)

```bash
npm install
docker compose up -d                 # local Postgres + Neon HTTP proxy
cp .env.example .env.local           # then set DATABASE_URL to the local value shown in the file
npm run db:migrate
npm run dev                          # http://localhost:3000
npm test                             # parser + statistics tests
```
