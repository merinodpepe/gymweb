"use client";

import { BodySchema } from "@/domain/schemas/body";
import { Button, Field, Input } from "../ui";
import { FormMessage, formValues, useSubmit } from "./use-submit";

/** Steps alone: the stored weigh-in of that day is left untouched. */
export function StepsForm({ today }: { today: string }) {
  const { submit, errors, message } = useSubmit(BodySchema, "/api/body");
  return (
    <form
      noValidate
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const v = formValues(form);
        const ok = await submit({ date: v.date, steps: v.steps || undefined });
        if (ok) (form.elements.namedItem("steps") as HTMLInputElement).value = "";
      }}
    >
      <Field label="Fecha" htmlFor="steps-date" error={errors.date}>
        <Input id="steps-date" name="date" type="date" defaultValue={today} max={today} required />
      </Field>
      <Field label="Pasos" htmlFor="steps-steps" error={errors.steps ?? errors._form}>
        <Input id="steps-steps" name="steps" inputMode="numeric" placeholder="9500" />
      </Field>
      <Button type="submit" className="col-span-2 sm:col-span-1">
        Guardar pasos
      </Button>
      <div className="col-span-2 sm:col-span-3">
        <FormMessage message={message} />
      </div>
    </form>
  );
}
