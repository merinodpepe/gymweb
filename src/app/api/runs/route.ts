import { NextResponse, type NextRequest } from "next/server";
import { RunSchema } from "@/domain/schemas/run";
import { badRequest, handle, readJson } from "@/lib/api";
import { runRepo } from "@/repositories/runRepo";

export const GET = handle(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  return NextResponse.json(await runRepo.list({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined }));
});

export const POST = handle(async (req: Request) => {
  const parsed = RunSchema.safeParse(await readJson(req));
  if (!parsed.success) return badRequest(parsed.error);
  return NextResponse.json(await runRepo.create(parsed.data), { status: 201 });
});
