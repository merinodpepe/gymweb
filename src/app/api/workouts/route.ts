import { NextResponse, type NextRequest } from "next/server";
import { SaveWorkoutSchema } from "@/domain/schemas/workout";
import { badRequest, handle, readJson } from "@/lib/api";
import { workoutRepo } from "@/repositories/workoutRepo";
import { saveWorkout } from "@/services/workoutService";

export const GET = handle(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  return NextResponse.json(await workoutRepo.list({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined }));
});

export const POST = handle(async (req: Request) => {
  const parsed = SaveWorkoutSchema.safeParse(await readJson(req));
  if (!parsed.success) return badRequest(parsed.error);
  const result = await saveWorkout(parsed.data.raw_text, parsed.data.replace);
  switch (result.status) {
    case "duplicate":
      return NextResponse.json(
        { error: "Ya existe un entreno con esa fecha y rutina", ...result },
        { status: 409 },
      );
    case "invalid":
      return NextResponse.json({ error: "No se pudo interpretar el entreno", ...result }, { status: 422 });
    default:
      return NextResponse.json(result, { status: result.status === "created" ? 201 : 200 });
  }
});
