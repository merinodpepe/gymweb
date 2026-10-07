import { NextResponse } from "next/server";
import { z } from "zod";
import { RunSchema } from "@/domain/schemas/run";
import { badRequest, handle, readJson } from "@/lib/api";
import { runRepo } from "@/repositories/runRepo";

type Ctx = { params: Promise<{ id: string }> };
const Id = z.string().uuid();

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const id = Id.safeParse((await ctx.params).id);
  if (!id.success) return badRequest(id.error);
  const parsed = RunSchema.safeParse(await readJson(req));
  if (!parsed.success) return badRequest(parsed.error);
  const row = await runRepo.update(id.data, parsed.data);
  return row ? NextResponse.json(row) : NextResponse.json({ error: "No existe" }, { status: 404 });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const id = Id.safeParse((await ctx.params).id);
  if (!id.success) return badRequest(id.error);
  await runRepo.remove(id.data);
  return NextResponse.json({ ok: true });
});
