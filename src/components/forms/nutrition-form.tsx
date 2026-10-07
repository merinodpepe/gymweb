"use client";

import { NutritionSchema } from "@/domain/schemas/nutrition";
import { Button, Field, Input } from "../ui";
import { FormMessage, formValues, useSubmit } from "./use-submit";

export function NutritionForm({ today }: { today: string }) {
  const { submit, errors, message } = useSubmit(NutritionSchema, "/api/nutrition");
  return (
    <form
      noValidate
      className="grid grid-cols-2 gap-3 md:grid-cols-6 md:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        if (await submit(formValues(form), "Día guardado")) form.reset();
      }}
    >
      <Field label="Fecha" htmlFor="n-date" error={errors.date}>
        <Input id="n-date" name="date" type="date" defaultValue={today} max={today} />
      </Field>
      <Field label="Kcal" htmlFor="n-kcal" error={errors.kcal}>
        <Input id="n-kcal" name="kcal" inputMode="numeric" placeholder="2400" />
      </Field>
      <Field label="Proteína (g)" htmlFor="n-prot" error={errors.protein_g}>
        <Input id="n-prot" name="protein_g" inputMode="decimal" placeholder="160" />
      </Field>
      <Field label="Carbohidratos (g)" htmlFor="n-carbs" error={errors.carbs_g}>
        <Input id="n-carbs" name="carbs_g" inputMode="decimal" placeholder="250" />
      </Field>
      <Field label="Fibra (g)" htmlFor="n-fiber" error={errors.fiber_g}>
        <Input id="n-fiber" name="fiber_g" inputMode="decimal" placeholder="30" />
      </Field>
      <Button type="submit">Guardar</Button>
      <div className="col-span-2 md:col-span-6">
        <FormMessage message={message} />
      </div>
    </form>
  );
}
