"use client";

import { BodySchema } from "@/domain/schemas/body";
import { Button, Field, Input } from "../ui";
import { FormMessage, formValues, useSubmit } from "./use-submit";

export function BodyForm({ today }: { today: string }) {
  const { submit, errors, message } = useSubmit(BodySchema, "/api/body");
  return (
    <form
      noValidate
      className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const v = formValues(form);
        const ok = await submit({
          date: v.date,
          weight_kg: v.weight_kg || undefined,
          steps: v.steps || undefined,
        });
        if (ok) {
          (form.elements.namedItem("weight_kg") as HTMLInputElement).value = "";
          (form.elements.namedItem("steps") as HTMLInputElement).value = "";
        }
      }}
    >
      <Field label="Fecha" htmlFor="body-date" error={errors.date}>
        <Input id="body-date" name="date" type="date" defaultValue={today} max={today} required />
      </Field>
      <Field label="Peso (kg)" htmlFor="body-weight" error={errors.weight_kg ?? errors._form}>
        <Input id="body-weight" name="weight_kg" inputMode="decimal" placeholder="78,4" />
      </Field>
      <Field label="Pasos" htmlFor="body-steps" error={errors.steps}>
        <Input id="body-steps" name="steps" inputMode="numeric" placeholder="9500" />
      </Field>
      <Button type="submit" className="col-span-2 sm:col-span-1">
        Guardar
      </Button>
      <div className="col-span-2 sm:col-span-4">
        <FormMessage message={message} />
      </div>
    </form>
  );
}
