import Link from "next/link";
import { cn } from "@/lib/cn";

const RANGES = [
  { value: "30d", label: "30 d" },
  { value: "90d", label: "90 d" },
  { value: "1y", label: "1 año" },
  { value: "all", label: "Todo" },
];

export function RangeTabs({ current, basePath }: { current: string; basePath: string }) {
  return (
    <nav aria-label="Rango de fechas" className="flex rounded-md border border-border bg-surface p-0.5">
      {RANGES.map((r) => (
        <Link
          key={r.value}
          href={`${basePath}?range=${r.value}`}
          aria-current={current === r.value ? "true" : undefined}
          className={cn(
            "flex min-h-10 items-center rounded px-3 text-xs uppercase tracking-wide text-muted hover:text-strong",
            current === r.value && "bg-surface-2 text-strong",
          )}
        >
          {r.label}
        </Link>
      ))}
    </nav>
  );
}

export const normalizeRange = (r: string | string[] | undefined) =>
  typeof r === "string" && RANGES.some((x) => x.value === r) ? r : "90d";
