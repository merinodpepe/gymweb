import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { authorizationUrl, GoogleHealthError, STATE_COOKIE } from "@/services/googleHealthService";

/** Starts the OAuth flow (needs the app session; the state cookie guards the callback against CSRF). */
export const GET = handle(async (req: Request) => {
  const origin = new URL(req.url).origin;
  const state = randomBytes(24).toString("base64url");
  let url: string;
  try {
    url = authorizationUrl(origin, state);
  } catch (err) {
    if (err instanceof GoogleHealthError) return NextResponse.redirect(new URL(`/importar?google=${encodeURIComponent(err.message)}`, origin));
    throw err;
  }
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/google", maxAge: 600 });
  return res;
});
