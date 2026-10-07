"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteButton({ url, label, confirmText }: { url: string; label: string; confirmText: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={label}
      title={label}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted hover:bg-bad/10 hover:text-bad disabled:opacity-50"
      onClick={async () => {
        if (!window.confirm(confirmText)) return;
        setBusy(true);
        const res = await fetch(url, { method: "DELETE" });
        setBusy(false);
        if (res.ok) router.refresh();
        else window.alert("No se pudo borrar");
      }}
    >
      <Trash2 aria-hidden className="size-4" />
    </button>
  );
}
