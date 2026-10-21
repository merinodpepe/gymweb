import { BODY_BACK_SVG, BODY_FRONT_SVG } from "@/data/bodyMapSvg";
import type { GroupReport } from "@/domain/coach/weeklyCoach";
import { classify, type VolumeStatus } from "@/domain/coach/volumeTargets";
import { fmt as fmtNum } from "@/lib/format";

const SLUG: Record<string, string> = {
  Pecho: "pecho",
  Espalda: "espalda",
  Hombro: "hombro",
  Bíceps: "biceps",
  Tríceps: "triceps",
  Cuádriceps: "cuadriceps",
  Isquios: "isquios",
  Glúteo: "gluteo",
  Gemelo: "gemelo",
  Core: "core",
  Antebrazo: "antebrazo",
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : fmtNum(n, 1));

const LEVELS: Record<VolumeStatus | "ninguna", { label: string; color: string }> = {
  ninguna: { label: "Sin series", color: "var(--surface-2)" },
  muy_bajo: { label: "Muy bajo", color: "var(--bad)" },
  bajo: { label: "Bajo", color: "var(--heat-warn)" },
  objetivo: { label: "En objetivo", color: "var(--good)" },
  alto: { label: "Por encima", color: "var(--heat-high)" },
};
const ORDER = ["ninguna", "muy_bajo", "bajo", "objetivo", "alto"] as const;

const levelOf = (value: number, g: GroupReport) => (value <= 0 ? "ninguna" : classify(value, g.range));

/**
 * Front and back muscle map. Each muscle is coloured by its sets against the weekly range of its group
 * (same thresholds as the lists below): red very low, amber low, green on target, blue above the maximum.
 * The SVG is our own generated file, never user input.
 */
export function BodyHeatmap({ groups, value }: { groups: GroupReport[]; value: (g: GroupReport) => number }) {
  const vars: Record<string, string> = {};
  const labels: string[] = [];
  for (const g of groups) {
    const level = levelOf(value(g), g);
    const slug = SLUG[g.group];
    if (slug) vars[`--mg-${slug}`] = LEVELS[level].color;
    labels.push(`${g.group} ${fmt(value(g))} series, ${LEVELS[level].label.toLowerCase()}`);
  }
  return (
    <div>
      <div className="mx-auto grid max-w-md grid-cols-2 gap-4" style={vars} role="img" aria-label={`Mapa muscular: ${labels.join("; ")}`}>
        <div dangerouslySetInnerHTML={{ __html: BODY_FRONT_SVG }} />
        <div dangerouslySetInnerHTML={{ __html: BODY_BACK_SVG }} />
      </div>
      <ul className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
        {ORDER.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-sm border border-border" style={{ background: LEVELS[k].color }} />
            {LEVELS[k].label}
          </li>
        ))}
      </ul>
    </div>
  );
}
