import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { GoogleHealthError, syncGoogleHealth } from "@/services/googleHealthService";

export const maxDuration = 60;

/** Manual / on-open sync. `?days=90` reads further back (max 90). */
export const POST = handle(async (req: Request) => {
  const days = Number(new URL(req.url).searchParams.get("days")) || undefined;
  try {
    return NextResponse.json(await syncGoogleHealth({ days }));
  } catch (err) {
    if (err instanceof GoogleHealthError) return NextResponse.json({ error: err.message }, { status: 502 });
    throw err;
  }
});
