import { hasDatabase } from "@/components/db-missing";
import { GoogleHealthCard } from "@/components/forms/google-health-card";
import { SyncLyftaButton } from "@/components/forms/sync-lyfta-button";
import { ImportLyfta } from "@/components/forms/import-lyfta";
import { PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { exerciseAliasRepo } from "@/repositories/exerciseAliasRepo";
import { googleStatus } from "@/services/googleHealthService";

export const metadata = { title: "Importar Lyfta" };

export default async function ImportPage({ searchParams }: PageProps<"/importar">) {
  const notice = (await searchParams).google;
  // Known dumbbell exercises, so the in-browser preview counts their volume ×2 like the server.
  const dumbbells = hasDatabase() ? [...(await exerciseAliasRepo.dumbbells())] : [];
  const google = hasDatabase() ? await googleStatus() : null;
  return (
    <>
      <PageHeader title="Importar Lyfta" subtitle="Pega el entreno, revisa la vista previa y los avisos, y guarda." />
      <SyncLyftaButton />
      {google && (
        <GoogleHealthCard
          connected={google.connected}
          lastSync={google.lastSyncAt ? fmtDate(google.lastSyncAt.toISOString().slice(0, 16), { time: true }) : null}
          notice={typeof notice === "string" ? notice : null}
        />
      )}
      <ImportLyfta dumbbells={dumbbells} />
    </>
  );
}
