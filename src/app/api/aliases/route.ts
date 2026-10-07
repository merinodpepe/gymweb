import { NextResponse } from "next/server";
import { AliasSchema } from "@/domain/schemas/workout";
import { badRequest, handle, readJson } from "@/lib/api";
import { exerciseAliasRepo } from "@/repositories/exerciseAliasRepo";

export const GET = handle(async () => NextResponse.json(await exerciseAliasRepo.list()));

export const POST = handle(async (req: Request) => {
  const parsed = AliasSchema.safeParse(await readJson(req));
  if (!parsed.success) return badRequest(parsed.error);
  await exerciseAliasRepo.upsert(parsed.data);
  return NextResponse.json({ ok: true });
});
