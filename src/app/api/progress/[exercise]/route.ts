import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getExerciseProgress } from "@/services/progressService";

type Ctx = { params: Promise<{ exercise: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { exercise } = await ctx.params;
  return NextResponse.json(await getExerciseProgress(decodeURIComponent(exercise)));
});
