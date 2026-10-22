"use client";

import { BodySchema } from "@/domain/schemas/body";
import { Button, Field, Input } from "../ui";
import { FormMessage, formValues, useSubmit } from "./use-submit";

/** Energy of the day and body measurements; weight and steps of that day are left untouched. */
export function MeasuresForm({ today }: { today: string }) {
  const { submit, errors, message } = useSubmit(BodySchema, "/api/body");
  return (
    <form
      noValidate
      className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const v = formValues(form);
        const ok = await submit(
          { date: v.date, energy: v.energy || undefined, waist_cm: v.waist_cm || undefined, arm_cm: v.arm_cm || undefined },
          "Guardado",
        );
        if (ok) for (const n of ["energy", "waist_cm", "arm_cm"]) (form.elements.namedItem(n) as HTMLInputElement).value = "";
      }}
    >
      <Field label="Fecha" htmlFor="m-date" error={errors.date}>
        <Input id="m-date" name="date" type="date" defaultValue={today} max={today} required />
      </Field>
      <Field label="Energía (1-10)" htmlFor="m-energy" error={errors.energy}>
        <Input id="m-energy" name="energy" inputMode="numeric" placeholder="7" />
      </Field>
      <Field label="Cintura (cm)" htmlFor="m-waist" error={errors.waist_cm}>
        <Input id="m-waist" name="waist_cm" inputMode="decimal" placeholder="84,5" />
      </Field>
      <Field label="Brazo (cm)" htmlFor="m-arm" error={errors.arm_cm ?? errors._form}>
        <Input id="m-arm" name="arm_cm" inputMode="decimal" placeholder="37" />
      </Field>
      <div className="col-span-2 flex items-center gap-4 sm:col-span-4">
        <Button type="submit">Guardar</Button>
        <FormMessage message={message} />
      </div>
    </form>
  );
}
