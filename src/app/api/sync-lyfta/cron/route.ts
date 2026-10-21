import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { googleStatus, syncGoogleHealth } from "@/services/googleHealthService";
import { LyftaApiError, syncFromLyfta } from "@/services/lyftaSyncService";

export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Scheduled sync of Lyfta and Google Health (Vercel Cron and GitHub Actions send `Authorization: Bearer $CRON_SECRET`). */
export const GET = handle(async (req: Request) => {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  // Google Health (steps and weight) runs too when connected; its failure never hides the Lyfta result.
  const google = (await googleStatus()).connected
    ? await syncGoogleHealth().catch((e: unknown) => ({ error: e instanceof Error ? e.message : "Error" }))
    : null;
  try {
    return NextResponse.json({ ...(await syncFromLyfta()), google });
  } catch (err) {
    if (err instanceof LyftaApiError) return NextResponse.json({ error: err.message, google }, { status: 502 });
    throw err;
  }
});
