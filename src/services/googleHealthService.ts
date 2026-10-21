import "server-only";
import { isoToCivil, parseStepsRollup, planStepUpdates } from "@/domain/google/parse";
import { addDays, todayIso } from "@/domain/stats/weeks";
import { bodyRepo } from "@/repositories/bodyRepo";
import { googleAuthRepo } from "@/repositories/googleAuthRepo";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://health.googleapis.com/v4/users/me/dataTypes";
export const STATE_COOKIE = "gymweb_google_state";
export const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly"];
const DEFAULT_WINDOW_DAYS = 14;
const MAX_WINDOW_DAYS = 90; // dailyRollUp limit for steps

export class GoogleHealthError extends Error {}

const credentials = () => {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!id || !secret) throw new GoogleHealthError("Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET (ver SETUP.md).");
  return { id, secret };
};

export const redirectUri = (origin: string) => process.env.GOOGLE_REDIRECT_URI?.trim() || `${origin}/api/google/callback`;

export function authorizationUrl(origin: string, state: string): string {
  const q = new URLSearchParams({
    client_id: credentials().id,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${q}`;
}

async function tokenRequest(params: Record<string, string>) {
  const { id, secret } = credentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...params }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    error?: string;
  };
  if (!res.ok || !body.access_token) {
    if (body.error === "invalid_grant") {
      throw new GoogleHealthError("Google ha revocado el acceso (o caducó): vuelve a conectar.");
    }
    throw new GoogleHealthError(`Google rechazó la petición de token (${body.error ?? res.status}).`);
  }
  return body;
}

/** Exchanges the OAuth code and stores the refresh token. */
export async function connectWithCode(code: string, origin: string): Promise<void> {
  const body = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri(origin) });
  if (!body.refresh_token) {
    throw new GoogleHealthError("Google no devolvió un token de renovación: quita el acceso de GymWeb en tu cuenta de Google y conecta de nuevo.");
  }
  const granted = body.scope ?? "";
  const missing = GOOGLE_SCOPES.filter((s) => !granted.split(" ").includes(s));
  if (missing.length) throw new GoogleHealthError("Falta el permiso de actividad: márcalo en la pantalla de Google.");
  await googleAuthRepo.save(body.refresh_token, granted);
}

async function accessToken(): Promise<string> {
  const conn = await googleAuthRepo.get();
  if (!conn) throw new GoogleHealthError("Google Health no está conectado.");
  return (await tokenRequest({ grant_type: "refresh_token", refresh_token: conn.refreshToken })).access_token!;
}

async function api(token: string, path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) throw new GoogleHealthError("Google Health rechazó el acceso: vuelve a conectar.");
  if (res.status === 429) throw new GoogleHealthError("Límite de la API de Google Health; reinténtalo más tarde.");
  if (!res.ok) {
    const detail = ((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message;
    throw new GoogleHealthError(`Google Health respondió ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return res.json();
}

async function pages(fetchPage: (pageToken?: string) => Promise<unknown>): Promise<unknown[]> {
  const out: unknown[] = [];
  let token: string | undefined;
  do {
    const body = (await fetchPage(token)) as { nextPageToken?: string };
    out.push(body);
    token = body.nextPageToken || undefined;
  } while (token && out.length < 20);
  return out;
}

export interface GoogleSyncResult {
  days: number;
  steps_updated: number;
  warnings: string[];
}

/** Pulls daily steps for the last `days` days (today included) into body_log (weight is never read from Google). Idempotent. */
export async function syncGoogleHealth({ days = DEFAULT_WINDOW_DAYS }: { days?: number } = {}): Promise<GoogleSyncResult> {
  const window = Math.min(Math.max(1, Math.round(days)), MAX_WINDOW_DAYS);
  const today = todayIso();
  const from = addDays(today, -(window - 1));
  const token = await accessToken();

  const stepPages = await pages((pageToken) =>
    api(token, "/steps/dataPoints:dailyRollUp", {
      method: "POST",
      body: JSON.stringify({
        range: { start: isoToCivil(from), end: isoToCivil(addDays(today, 1)) },
        windowSizeDays: 1,
        pageSize: 1000,
        ...(pageToken && { pageToken }),
      }),
    }),
  );
  const parsed = stepPages.map(parseStepsRollup);
  const warnings: string[] = [];
  const unreadable = parsed.reduce((n, p) => n + p.unreadable, 0);
  if (unreadable) warnings.push(`${unreadable} registros de Google con un formato que no se reconoció.`);

  const stored = await bodyRepo.list({ from, to: today });
  const plan = planStepUpdates(
    stored,
    parsed.flatMap((p) => p.days),
  );
  for (const u of plan) await bodyRepo.upsert({ date: u.date, steps: u.steps, scale: undefined });
  await googleAuthRepo.touchSync();
  return {
    days: window,
    steps_updated: plan.length,
    warnings,
  };
}

export async function googleStatus() {
  const conn = await googleAuthRepo.get();
  return { connected: !!conn, connectedAt: conn?.connectedAt ?? null, lastSyncAt: conn?.lastSyncAt ?? null };
}
