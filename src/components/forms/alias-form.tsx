"use client";

import { type Alias, AliasSchema } from "@/domain/schemas/workout";
import { Button, Field, Input } from "../ui";
import { FormMessage, formValues, useSubmit } from "./use-submit";

/** Picking a raw name that already has an alias fills in its values, so saving doesn't reset them. */
export function AliasForm({ names, aliases }: { names: string[]; aliases: Alias[] }) {
  const { submit, errors, message } = useSubmit(AliasSchema, "/api/aliases");
  return (
    <form
      noValidate
      className="grid gap-3 md:grid-cols-5 md:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const v = formValues(form);
        const values = { ...v, muscle_group: v.muscle_group || null, dumbbell: v.dumbbell === "on" };
        if (await submit(values, "Alias guardado")) form.reset();
      }}
    >
      <Field label="Nombre en Lyfta" htmlFor="a-raw" error={errors.raw_name}>
        <Input
          id="a-raw"
          name="raw_name"
          list="exercise-names"
          placeholder="Lever Military Press"
          onChange={(e) => {
            const a = aliases.find((x) => x.raw_name === e.currentTarget.value.trim());
            if (!a) return;
            const form = e.currentTarget.form!;
            (form.elements.namedItem("canonical_name") as HTMLInputElement).value = a.canonical_name;
            (form.elements.namedItem("muscle_group") as HTMLInputElement).value = a.muscle_group ?? "";
            (form.elements.namedItem("dumbbell") as HTMLInputElement).checked = a.dumbbell;
          }}
        />
      </Field>
      <Field label="Nombre canónico" htmlFor="a-canon" error={errors.canonical_name}>
        <Input id="a-canon" name="canonical_name" list="exercise-names" placeholder="Press militar" />
      </Field>
      <Field label="Grupo muscular" htmlFor="a-group" error={errors.muscle_group}>
        <Input id="a-group" name="muscle_group" list="muscle-groups" placeholder="Hombro" />
      </Field>
      <label className="flex min-h-10 items-center gap-2 text-sm text-strong">
        <input type="checkbox" name="dumbbell" className="size-4 accent-[var(--accent)]" />
        Mancuernas (volumen ×2)
      </label>
      <Button type="submit">Guardar alias</Button>
      <datalist id="exercise-names">
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id="muscle-groups">
        {["Pecho", "Espalda", "Hombro", "Bíceps", "Tríceps", "Cuádriceps", "Isquios", "Glúteo", "Gemelo", "Core", "Antebrazo"].map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <div className="md:col-span-5">
        <FormMessage message={message} />
      </div>
    </form>
  );
}
