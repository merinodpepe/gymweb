import { NextResponse, type NextRequest } from "next/server";
import { BodySchema } from "@/domain/schemas/body";
import { IsoDate } from "@/domain/schemas/common";
import { badRequest, handle, readJson } from "@/lib/api";
import { bodyRepo } from "@/repositories/bodyRepo";

export const GET = handle(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  return NextResponse.json(await bodyRepo.list({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined }));
});

const upsert = handle(async (req: Request) => {
  const parsed = BodySchema.safeParse(await readJson(req));
  if (!parsed.success) return badRequest(parsed.error);
  await bodyRepo.upsert(parsed.data);
  return NextResponse.json({ ok: true });
});
export const POST = upsert;
export const PUT = upsert;

export const DELETE = handle(async (req: NextRequest) => {
  const date = IsoDate.safeParse(req.nextUrl.searchParams.get("date"));
  if (!date.success) return badRequest(date.error);
  await bodyRepo.remove(date.data);
  return NextResponse.json({ ok: true });
});
