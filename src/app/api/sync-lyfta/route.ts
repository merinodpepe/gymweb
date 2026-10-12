import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { LyftaApiError, syncFromLyfta } from "@/services/lyftaSyncService";

export const maxDuration = 60;

/** Manual / on-open sync (protected by the app session via proxy.ts). `?full=1` re-reads all history. */
export const POST = handle(async (req: Request) => {
  try {
    return NextResponse.json(await syncFromLyfta({ full: new URL(req.url).searchParams.get("full") === "1" }));
  } catch (err) {
    if (err instanceof LyftaApiError) return NextResponse.json({ error: err.message }, { status: 502 });
    throw err;
  }
});
