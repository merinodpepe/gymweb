"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { z } from "zod";

export type FieldErrors = Record<string, string | undefined>;

function firstErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    out[key] ??= issue.message;
  }
  return out;
}

/** Validates with the shared Zod schema, sends JSON and refreshes server data. */
export function useSubmit<S extends z.ZodType>(schema: S, url: string, method = "POST") {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  async function submit(values: unknown, okText = "Guardado"): Promise<boolean> {
    setMessage(null);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setErrors(firstErrors(parsed.error));
      return false;
    }
    setErrors({});
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage({ ok: false, text: body.error ?? `Error ${res.status}` });
      return false;
    }
    setMessage({ ok: true, text: okText });
    startTransition(() => router.refresh());
    return true;
  }

  return { submit, errors, message, pending };
}

export function FormMessage({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null;
  return (
    <p role="status" aria-live="polite" className={message.ok ? "text-sm text-good" : "text-sm text-bad"}>
      {message.text}
    </p>
  );
}

export const formValues = (form: HTMLFormElement) => Object.fromEntries(new FormData(form).entries());
