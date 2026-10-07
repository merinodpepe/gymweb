// Minimal single-user session: an HMAC-signed expiry timestamp in an httpOnly
// cookie. Uses Web Crypto so it works in proxy.ts and in route handlers.

export const SESSION_COOKIE = "gymweb_session";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (≥ 32 characters). See SETUP.md.");
  return s;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Buffer.from(sig).toString("base64url");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(now = Date.now()): Promise<{ token: string; expires: Date }> {
  const expires = new Date(now + SESSION_DAYS * 86_400_000);
  const payload = String(expires.getTime());
  return { token: `${payload}.${await hmac(payload)}`, expires };
}

export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !/^\d+$/.test(payload)) return false;
  if (Number(payload) < now) return false;
  try {
    return safeEqual(sig, await hmac(payload));
  } catch {
    return false;
  }
}

/** Constant-time password check (compares HMACs of both strings). */
export async function checkPassword(candidate: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  return safeEqual(await hmac(`pw:${candidate}`), await hmac(`pw:${expected}`));
}
