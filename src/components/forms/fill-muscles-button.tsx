"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../ui";

export function FillMusclesButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch("/api/aliases/fill-muscles", { method: "POST" });
          setBusy(false);
          if (!res.ok) return setText("No se pudo rellenar");
          const r: { filled: number; unmatched: string[] } = await res.json();
          setText(
            `${r.filled} rellenados${r.unmatched.length ? `; sin coincidencia: ${r.unmatched.join(", ")}` : ""}`,
          );
          router.refresh();
        }}
      >
        Rellenar grupos que faltan
      </Button>
      {text ? (
        <p role="status" className="text-sm text-muted">
          {text}
        </p>
      ) : null}
    </div>
  );
}
