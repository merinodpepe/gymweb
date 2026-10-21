"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../ui";

export function GoogleHealthCard({ connected, lastSync, notice }: { connected: boolean; lastSync: string | null; notice: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<{ ok: boolean; msg: string } | null>(
    notice ? { ok: notice === "ok", msg: notice === "ok" ? "Google Health conectado. Pulsa «Sincronizar» para traer tus datos." : notice } : null,
  );

  async function sync(days?: number) {
    setBusy(true);
    setText(null);
    const res = await fetch(`/api/google/sync${days ? `?days=${days}` : ""}`, { method: "POST" }).catch(() => null);
    setBusy(false);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) return setText({ ok: false, msg: body?.error ?? "No se pudo sincronizar" });
    const extra = body.warnings?.length ? ` ${body.warnings.join(" ")}` : "";
    setText({ ok: true, msg: `${body.steps_updated} días de pasos y ${body.weights_added} pesajes nuevos (últimos ${body.days} días).${extra}` });
    router.refresh();
  }

  async function disconnect() {
    if (!confirm("¿Desconectar Google Health? Los datos ya guardados se conservan.")) return;
    setBusy(true);
    await fetch("/api/google/disconnect", { method: "POST" }).catch(() => null);
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="mb-6 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-lg text-strong">Google Health</h2>
      <p className="mb-3 text-xs text-muted">
        Trae tus pasos y tu peso. No pisa un pesaje que ya hayas registrado; los pasos solo suben si Google tiene más.
        {connected && lastSync && ` Última sincronización: ${lastSync}.`}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {connected ? (
          <>
            <Button type="button" disabled={busy} onClick={() => sync()}>
              Sincronizar Google Health
            </Button>
            <button type="button" disabled={busy} className="min-h-10 text-xs text-muted underline hover:text-strong disabled:opacity-50" onClick={() => sync(90)}>
              Traer 90 días
            </button>
            <button type="button" disabled={busy} className="min-h-10 text-xs text-muted underline hover:text-strong disabled:opacity-50" onClick={disconnect}>
              Desconectar
            </button>
          </>
        ) : (
          // A plain link: the server redirects to Google.
          <a
            href="/api/google/connect"
            className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-semibold uppercase tracking-wide text-accent-ink"
          >
            Conectar Google Health
          </a>
        )}
        {text ? (
          <p role="status" className={text.ok ? "text-sm text-good" : "text-sm text-bad"}>
            {text.msg}
          </p>
        ) : null}
      </div>
    </section>
  );
}
