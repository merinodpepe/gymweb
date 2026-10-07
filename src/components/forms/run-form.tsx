"use client";

import { RunSchema } from "@/domain/schemas/run";
import { Button, Field, Input, Select } from "../ui";
import { FormMessage, formValues, useSubmit } from "./use-submit";

/** "45:30" → 2730, "1:02:10" → 3730, "50" → 3000 (minutes). */
export function parseDuration(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const parts = t.split(":").map((p) => Number(p.replace(",", ".")));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return NaN;
  if (parts.length === 1) return Math.round(parts[0] * 60);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return NaN;
}

export function RunForm({ today }: { today: string }) {
  const { submit, errors, message } = useSubmit(RunSchema, "/api/runs");
  return (
    <form
      noValidate
      className="grid grid-cols-2 gap-3 md:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const v = formValues(form);
        const ok = await submit(
          {
            date: v.date,
            distance_km: v.distance_km,
            duration_s: parseDuration(String(v.duration ?? "")),
            elevation_gain_m: v.elevation_gain_m || 0,
            surface: v.surface,
            notes: String(v.notes ?? "") || null,
          },
          "Carrera guardada",
        );
        if (ok) form.reset();
      }}
    >
      <Field label="Fecha" htmlFor="run-date" error={errors.date}>
        <Input id="run-date" name="date" type="date" defaultValue={today} max={today} />
      </Field>
      <Field label="Superficie" htmlFor="run-surface" error={errors.surface}>
        <Select id="run-surface" name="surface" defaultValue="outdoor">
          <option value="outdoor">Exterior</option>
          <option value="treadmill">Cinta</option>
        </Select>
      </Field>
      <Field label="Distancia (km)" htmlFor="run-distance" error={errors.distance_km}>
        <Input id="run-distance" name="distance_km" inputMode="decimal" placeholder="5,2" />
      </Field>
      <Field label="Tiempo" htmlFor="run-duration" hint="mm:ss o h:mm:ss" error={errors.duration_s}>
        <Input id="run-duration" name="duration" placeholder="27:45" />
      </Field>
      <Field label="Desnivel + (m)" htmlFor="run-elev" error={errors.elevation_gain_m}>
        <Input id="run-elev" name="elevation_gain_m" inputMode="numeric" placeholder="0" />
      </Field>
      <Field label="Notas" htmlFor="run-notes" error={errors.notes}>
        <Input id="run-notes" name="notes" placeholder="Opcional" />
      </Field>
      <div className="col-span-2 flex items-center gap-4 md:col-span-3">
        <Button type="submit">Añadir carrera</Button>
        <FormMessage message={message} />
      </div>
    </form>
  );
}
