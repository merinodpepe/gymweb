import { BODY_BACK_SVG, BODY_FRONT_SVG } from "@/data/bodyMapSvg";
import type { GroupReadiness, ReadinessLevel } from "@/domain/coach/readiness";
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

interface Swatch {
  label: string;
  color: string;
}

/** Front and back muscle map, one fill per group. The SVG is our own generated file, never user input. */
function BodyMap({ fills, legend, label }: { fills: (Swatch & { group: string })[]; legend: Swatch[]; label: string }) {
  const vars: Record<string, string> = {};
  for (const f of fills) {
    const slug = SLUG[f.group];
    if (slug) vars[`--mg-${slug}`] = f.color;
  }
  return (
    <div>
      <div
        className="mx-auto grid max-w-md grid-cols-2 gap-4"
        style={vars}
        role="img"
        aria-label={`${label}: ${fills.map((f) => f.label).join("; ")}`}
      >
        <div dangerouslySetInnerHTML={{ __html: BODY_FRONT_SVG }} />
        <div dangerouslySetInnerHTML={{ __html: BODY_BACK_SVG }} />
      </div>
      <ul className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
        {legend.map((k) => (
          <li key={k.label} className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-sm border border-border" style={{ background: k.color }} />
            {k.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Each muscle coloured by its sets against the weekly range of its group (same thresholds as the lists
 * below): red very low, amber low, green on target, blue above the maximum.
 */
export function BodyHeatmap({ groups, value }: { groups: GroupReport[]; value: (g: GroupReport) => number }) {
  const fills = groups.map((g) => {
    const level = levelOf(value(g), g);
    return {
      group: g.group,
      color: LEVELS[level].color,
      label: `${g.group} ${fmt(value(g))} series, ${LEVELS[level].label.toLowerCase()}`,
    };
  });
  return <BodyMap fills={fills} legend={ORDER.map((k) => LEVELS[k])} label="Mapa muscular" />;
}

export const READINESS: Record<ReadinessLevel, Swatch> = {
  fatigado: { label: "Fatigado", color: "var(--bad)" },
  recuperando: { label: "Recuperando", color: "color-mix(in srgb, var(--bad), var(--heat-warn))" },
  casi: { label: "Casi listo", color: "var(--heat-warn)" },
  listo: { label: "Listo", color: "var(--good)" },
};
const READINESS_ORDER = ["fatigado", "recuperando", "casi", "listo"] as const;

/** Each muscle coloured by how recovered it is from the last days' sets. */
export function ReadinessMap({ groups }: { groups: GroupReadiness[] }) {
  const fills = groups.map((g) => ({
    group: g.group,
    color: READINESS[g.level].color,
    label: `${g.group} ${Math.round(g.readiness * 100)} %, ${READINESS[g.level].label.toLowerCase()}`,
  }));
  return <BodyMap fills={fills} legend={READINESS_ORDER.map((k) => READINESS[k])} label="Mapa de recuperación" />;
}
