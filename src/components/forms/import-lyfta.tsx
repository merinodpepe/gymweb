"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { ParseResult } from "@/domain/lyfta/parseLyfta";
import { parseLyfta } from "@/domain/lyfta/parseLyfta";
import { fmt, fmtDate } from "@/lib/format";
import { ExerciseCard } from "../exercise-card";
import { Button, Card, CardTitle, Textarea } from "../ui";

const PLACEHOLDER = `Day 4: Shoulders, Arms & Abs
lunes, 5 de octubre de 2026, 18:54

3h 1m | 6 893.5kg | 8 Ejercicios | 21 series

1. Lever Military Press
Serie 1: 36kg x 9 reps (Calentamiento)
Serie 2: 50kg x 6 reps
…`;

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; id: string; replaced: boolean }
  | { kind: "duplicate" }
  | { kind: "error"; text: string };

export function ImportLyfta() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  // The parser is pure, so the preview runs in the browser (same code as the server).
  const analyze = () => {
    setPreview(parseLyfta(text));
    setSave({ kind: "idle" });
  };

  const doSave = async (replace: boolean) => {
    setSave({ kind: "saving" });
    const res = await fetch("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: text, replace }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 409) setSave({ kind: "duplicate" });
    else if (!res.ok) setSave({ kind: "error", text: body.error ?? `Error ${res.status}` });
    else setSave({ kind: "saved", id: body.id, replaced: body.status === "replaced" });
  };

  const w = preview?.workout;
  const canSave = Boolean(w && w.routine_name && !w.date.startsWith("1970") && w.exercises.length);

  return (
    <div className="grid gap-6">
      <Card>
        <label htmlFor="lyfta-text" className="font-display text-base text-strong">
          Texto exportado de Lyfta
        </label>
        <p className="mb-3 text-xs text-muted">En Lyfta: entreno → compartir → copiar como texto. Pégalo aquí tal cual.</p>
        <Textarea
          id="lyfta-text"
          rows={14}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
        />
        <div className="mt-3 flex gap-3">
          <Button onClick={analyze} disabled={!text.trim()}>
            Analizar
          </Button>
          {preview && (
            <Button variant="ghost" onClick={() => { setText(""); setPreview(null); setSave({ kind: "idle" }); }}>
              Limpiar
            </Button>
          )}
        </div>
      </Card>

      {preview && w && (
        <Card aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">{w.routine_name || "Sin nombre"}</CardTitle>
              <p className="text-sm text-muted">
                {w.date.startsWith("1970") ? "Fecha no reconocida" : fmtDate(w.date, { time: true })} ·{" "}
                {w.duration_min} min · {fmt(w.total_volume_kg, 1)} kg · {w.exercises.length} ejercicios ·{" "}
                {preview.checks.parsed_sets} series
              </p>
            </div>
            {preview.checks.volume_rule && (
              <span className="inline-flex items-center gap-1 text-xs text-good">
                <CheckCircle2 aria-hidden className="size-4" />
                Volumen cuadra ({preview.checks.volume_rule === "all_sets" ? "con calentamientos" : "sin calentamientos"})
              </span>
            )}
          </div>

          {preview.warnings.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-md border border-accent/40 bg-accent/5 p-3 text-sm">
              {preview.warnings.map((m, i) => (
                <li key={i} className="flex gap-2">
                  <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {w.exercises.map((e, i) => (
              <ExerciseCard key={i} name={e.name} notes={e.notes} sets={e.sets} />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {save.kind === "duplicate" ? (
              <>
                <p className="text-sm text-accent">Ya hay un entreno con esa fecha y rutina.</p>
                <Button onClick={() => doSave(true)}>Reemplazar</Button>
                <Button variant="ghost" onClick={() => setSave({ kind: "idle" })}>
                  Cancelar
                </Button>
              </>
            ) : save.kind === "saved" ? (
              <p className="text-sm text-good" role="status">
                {save.replaced ? "Entreno reemplazado." : "Entreno guardado."}{" "}
                <Link className="underline" href="/entrenos">
                  Ver entrenos
                </Link>
              </p>
            ) : (
              <Button onClick={() => doSave(false)} disabled={!canSave || save.kind === "saving"} aria-busy={save.kind === "saving"}>
                {save.kind === "saving" ? "Guardando…" : "Guardar"}
              </Button>
            )}
            {save.kind === "error" && <p className="text-sm text-bad" role="alert">{save.text}</p>}
          </div>
        </Card>
      )}
    </div>
  );
}
