import { AlertTriangle, Info } from "lucide-react";
import type { Alert } from "@/domain/insights/alerts";
import { cn } from "@/lib/cn";
import { Card, CardTitle } from "./ui";

/** Automatic notices derived from the data. Renders nothing when there are none. */
export function AlertsCard({ alerts, className }: { alerts: Alert[]; className?: string }) {
  if (!alerts.length) return null;
  return (
    <Card className={className}>
      <CardTitle>Avisos</CardTitle>
      <ul className="mt-3 space-y-2">
        {alerts.map((a) => {
          const Icon = a.level === "warn" ? AlertTriangle : Info;
          return (
            <li key={a.id} className="flex items-start gap-2 text-sm">
              <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", a.level === "warn" ? "text-accent" : "text-muted")} />
              <span>
                <span className="sr-only">{a.level === "warn" ? "Atención: " : "Información: "}</span>
                {a.text}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
