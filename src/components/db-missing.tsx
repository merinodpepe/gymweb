import { Card, CardTitle } from "./ui";

export const hasDatabase = () => Boolean(process.env.DATABASE_URL);

export function DbMissing() {
  return (
    <Card className="border-accent/50">
      <CardTitle>Base de datos no configurada</CardTitle>
      <p className="mt-2 text-sm">
        Falta la variable <code className="text-strong">DATABASE_URL</code>. Sigue los pasos de{" "}
        <code className="text-strong">SETUP.md</code> en el repositorio (crear el proyecto en Neon y añadir la URL en
        Vercel).
      </p>
    </Card>
  );
}
