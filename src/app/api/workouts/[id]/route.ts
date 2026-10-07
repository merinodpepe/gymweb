import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, handle } from "@/lib/api";
import { workoutRepo } from "@/repositories/workoutRepo";

type Ctx = { params: Promise<{ id: string }> };
const Id = z.string().uuid();

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const id = Id.safeParse((await ctx.params).id);
  if (!id.success) return badRequest(id.error);
  const w = await workoutRepo.get(id.data);
  return w ? NextResponse.json(w) : NextResponse.json({ error: "No existe" }, { status: 404 });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const id = Id.safeParse((await ctx.params).id);
  if (!id.success) return badRequest(id.error);
  await workoutRepo.remove(id.data);
  return NextResponse.json({ ok: true });
});
