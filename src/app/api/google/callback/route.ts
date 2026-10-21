import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { connectWithCode, GoogleHealthError, STATE_COOKIE } from "@/services/googleHealthService";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const GET = handle(async (req: NextRequest) => {
  const { origin, searchParams: sp } = req.nextUrl;
  const back = (msg: string) => {
    const res = NextResponse.redirect(new URL(`/importar?google=${encodeURIComponent(msg)}`, origin));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/google" });
    return res;
  };
  const expected = req.cookies.get(STATE_COOKIE)?.value;
  const state = sp.get("state");
  if (!expected || !state || !same(expected, state)) return back("La conexión con Google caducó: inténtalo de nuevo.");
  if (sp.get("error")) return back(sp.get("error") === "access_denied" ? "Cancelaste el permiso de Google." : `Google devolvió: ${sp.get("error")}`);
  const code = sp.get("code");
  if (!code) return back("Google no devolvió ningún código.");
  try {
    await connectWithCode(code, origin);
  } catch (err) {
    if (err instanceof GoogleHealthError) return back(err.message);
    throw err;
  }
  return back("ok");
});
