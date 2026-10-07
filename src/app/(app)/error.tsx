"use client";

import { Button, Card, CardTitle } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card className="border-bad/50">
      <CardTitle>Algo ha fallado</CardTitle>
      <p className="mt-2 text-sm">
        No se pudieron cargar los datos. Si la base de datos llevaba tiempo sin usarse puede tardar un segundo en despertar.
      </p>
      <Button className="mt-4" onClick={reset}>
        Reintentar
      </Button>
    </Card>
  );
}
