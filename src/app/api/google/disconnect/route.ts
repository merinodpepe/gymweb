import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { googleAuthRepo } from "@/repositories/googleAuthRepo";

export const POST = handle(async () => {
  await googleAuthRepo.remove();
  return NextResponse.json({ ok: true });
});
