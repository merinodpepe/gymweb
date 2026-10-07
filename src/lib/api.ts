import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { MissingDatabaseError } from "./errors";

export function badRequest(error: z.ZodError) {
  return NextResponse.json({ error: "Datos no válidos", issues: z.flattenError(error) }, { status: 400 });
}

/** Wraps a route handler: maps known errors to JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof MissingDatabaseError) {
        return NextResponse.json({ error: err.message }, { status: 503 });
      }
      console.error(err);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
