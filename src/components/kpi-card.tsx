import { cn } from "@/lib/cn";

export function KpiCard({
  label,
  value,
  unit,
  detail,
  children,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  detail?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-lg border border-border bg-surface p-4", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display text-3xl text-strong num">
        {value}
        {unit && <span className="ml-1 text-base text-muted">{unit}</span>}
      </p>
      {detail && <div className="text-xs text-muted">{detail}</div>}
      {children}
    </div>
  );
}
