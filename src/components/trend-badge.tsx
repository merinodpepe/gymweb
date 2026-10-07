import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { TrendLabel } from "@/domain/stats/regression";
import { cn } from "@/lib/cn";

/**
 * Direction is always icon + text, never colour alone. `goodWhen` says which
 * direction is desirable (e.g. strength up = good; weight depends on the goal).
 */
export function TrendBadge({
  label,
  goodWhen = "up",
  texts = { up: "Sube", down: "Baja", flat: "Sin cambio claro" },
  className,
}: {
  label: TrendLabel | null;
  goodWhen?: "up" | "down" | "none";
  texts?: Record<TrendLabel, string>;
  className?: string;
}) {
  if (!label) return <span className={cn("text-xs text-muted", className)}>Datos insuficientes</span>;
  const Icon = label === "up" ? ArrowUpRight : label === "down" ? ArrowDownRight : ArrowRight;
  const tone =
    label === "flat" || goodWhen === "none" ? "text-neutral" : label === goodWhen ? "text-good" : "text-bad";
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-medium", tone, className)}>
      <Icon aria-hidden className="size-4" />
      {texts[label]}
    </span>
  );
}
