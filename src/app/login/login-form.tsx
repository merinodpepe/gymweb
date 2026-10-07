"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function Form() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const password = new FormData(e.currentTarget).get("password");
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        setBusy(false);
        if (res.ok) {
          router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
          router.refresh();
        } else {
          setError((await res.json().catch(() => ({}))).error ?? "No se pudo entrar");
        }
      }}
    >
      <label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-[#8f8f8f]">
        Contraseña
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        autoFocus
        className="min-h-11 rounded-md border border-[#363636] bg-[#0a0a0a] px-3 text-white focus:border-[#f36100]"
      />
      {error && (
        <p role="alert" className="text-sm text-[#f44336]">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="mt-2 min-h-11 rounded-md bg-[#f36100] font-semibold uppercase tracking-wide text-[#0a0a0a] disabled:opacity-60"
      >
        {busy ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export function LoginForm() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
