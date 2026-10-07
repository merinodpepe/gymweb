import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, handle, readJson } from "@/lib/api";
import { previewWorkout } from "@/services/workoutService";

const Body = z.object({ raw_text: z.string().max(100_000) });

/** Parses without saving. */
export const POST = handle(async (req: Request) => {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return badRequest(parsed.error);
  return NextResponse.json(previewWorkout(parsed.data.raw_text));
});
