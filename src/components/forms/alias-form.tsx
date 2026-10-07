"use client";

import { AliasSchema } from "@/domain/schemas/workout";
import { Button, Field, Input } from "../ui";
import { FormMessage, formValues, useSubmit } from "./use-submit";

export function AliasForm({ names }: { names: string[] }) {
  const { submit, errors, message } = useSubmit(AliasSchema, "/api/aliases");
  return (
    <form
      noValidate
      className="grid gap-3 md:grid-cols-4 md:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const v = formValues(form);
        if (await submit({ ...v, muscle_group: v.muscle_group || null }, "Alias guardado")) form.reset();
      }}
    >
      <Field label="Nombre en Lyfta" htmlFor="a-raw" error={errors.raw_name}>
        <Input id="a-raw" name="raw_name" list="exercise-names" placeholder="Lever Military Press" />
      </Field>
      <Field label="Nombre canónico" htmlFor="a-canon" error={errors.canonical_name}>
        <Input id="a-canon" name="canonical_name" list="exercise-names" placeholder="Press militar" />
      </Field>
      <Field label="Grupo muscular" htmlFor="a-group" error={errors.muscle_group}>
        <Input id="a-group" name="muscle_group" list="muscle-groups" placeholder="Hombro" />
      </Field>
      <Button type="submit">Guardar alias</Button>
      <datalist id="exercise-names">
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id="muscle-groups">
        {["Pecho", "Espalda", "Hombro", "Bíceps", "Tríceps", "Cuádriceps", "Isquios", "Glúteo", "Gemelo", "Core"].map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <div className="md:col-span-4">
        <FormMessage message={message} />
      </div>
    </form>
  );
}
