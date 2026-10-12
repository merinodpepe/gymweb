import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { LyftaApiError, syncFromLyfta } from "@/services/lyftaSyncService";

export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Scheduled sync (Vercel Cron and GitHub Actions send `Authorization: Bearer $CRON_SECRET`). */
export const GET = handle(async (req: Request) => {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    return NextResponse.json(await syncFromLyfta());
  } catch (err) {
    if (err instanceof LyftaApiError) return NextResponse.json({ error: err.message }, { status: 502 });
    throw err;
  }
});
