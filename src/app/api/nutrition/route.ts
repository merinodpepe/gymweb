import { NextResponse, type NextRequest } from "next/server";
import { IsoDate } from "@/domain/schemas/common";
import { NutritionSchema } from "@/domain/schemas/nutrition";
import { badRequest, handle, readJson } from "@/lib/api";
import { nutritionRepo } from "@/repositories/nutritionRepo";

export const GET = handle(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  return NextResponse.json(
    await nutritionRepo.list({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined }),
  );
});

const upsert = handle(async (req: Request) => {
  const parsed = NutritionSchema.safeParse(await readJson(req));
  if (!parsed.success) return badRequest(parsed.error);
  await nutritionRepo.upsert(parsed.data);
  return NextResponse.json({ ok: true });
});
export const POST = upsert;
export const PUT = upsert;

export const DELETE = handle(async (req: NextRequest) => {
  const date = IsoDate.safeParse(req.nextUrl.searchParams.get("date"));
  if (!date.success) return badRequest(date.error);
  await nutritionRepo.remove(date.data);
  return NextResponse.json({ ok: true });
});
