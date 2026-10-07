import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { checkPassword, createSessionToken, SESSION_COOKIE } from "@/lib/session";

const Body = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success || !(await checkPassword(parsed.data.password))) {
    // Small delay to slow down guessing.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }
  const { token, expires } = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
  return res;
}
