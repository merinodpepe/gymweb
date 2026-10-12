import { hasDatabase } from "@/components/db-missing";
import { SyncLyftaButton } from "@/components/forms/sync-lyfta-button";
import { ImportLyfta } from "@/components/forms/import-lyfta";
import { PageHeader } from "@/components/ui";
import { exerciseAliasRepo } from "@/repositories/exerciseAliasRepo";

export const metadata = { title: "Importar Lyfta" };

export default async function ImportPage() {
  // Known dumbbell exercises, so the in-browser preview counts their volume ×2 like the server.
  const dumbbells = hasDatabase() ? [...(await exerciseAliasRepo.dumbbells())] : [];
  return (
    <>
      <PageHeader title="Importar Lyfta" subtitle="Pega el entreno, revisa la vista previa y los avisos, y guarda." />
      <SyncLyftaButton />
      <ImportLyfta dumbbells={dumbbells} />
    </>
  );
}
