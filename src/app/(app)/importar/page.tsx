import { ImportLyfta } from "@/components/forms/import-lyfta";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Importar Lyfta" };

export default function ImportPage() {
  return (
    <>
      <PageHeader title="Importar Lyfta" subtitle="Pega el entreno, revisa la vista previa y los avisos, y guarda." />
      <ImportLyfta />
    </>
  );
}
