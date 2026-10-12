"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../ui";

export function SyncLyftaButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<{ ok: boolean; msg: string } | null>(null);
  async function run(full: boolean) {
    setBusy(true);
    setText(null);
    const res = await fetch(`/api/sync-lyfta${full ? "?full=1" : ""}`, { method: "POST" }).catch(() => null);
    setBusy(false);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) return setText({ ok: false, msg: body?.error ?? "No se pudo sincronizar" });
    setText({ ok: true, msg: `${body.created} entrenos nuevos, ${body.skipped} ya estaban.` });
    router.refresh();
  }
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <Button type="button" disabled={busy} onClick={() => run(false)}>
        Sincronizar con Lyfta
      </Button>
      <button
        type="button"
        disabled={busy}
        className="min-h-10 text-xs text-muted underline hover:text-strong disabled:opacity-50"
        onClick={() => run(true)}
      >
        Traer todo el historial
      </button>
      {text ? (
        <p role="status" className={text.ok ? "text-sm text-good" : "text-sm text-bad"}>
          {text.msg}
        </p>
      ) : null}
    </div>
  );
}
