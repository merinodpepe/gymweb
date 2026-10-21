import { BODY_BACK_SVG, BODY_FRONT_SVG } from "@/data/bodyMapSvg";
import type { GroupReport } from "@/domain/coach/weeklyCoach";
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

/** Share of the top of the target range reached (0 → 1), mapped to how strongly the accent shows. */
const heat = (value: number, max: number) => Math.round(10 + 90 * Math.min(1, value / max));

/**
 * Front and back muscle map. Each muscle is coloured by `value` sets against the top of its weekly range,
 * so a fully lit muscle is at (or past) its maximum. The SVG is our own generated file, never user input.
 */
export function BodyHeatmap({ groups, value }: { groups: GroupReport[]; value: (g: GroupReport) => number }) {
  const vars: Record<string, string> = {};
  for (const g of groups) {
    const slug = SLUG[g.group];
    if (slug) vars[`--mg-${slug}`] = `color-mix(in srgb, var(--accent) ${heat(value(g), g.range.max)}%, var(--surface-2))`;
  }
  const label = groups.map((g) => `${g.group} ${fmt(value(g))} series`).join(", ");
  return (
    <div>
      <div className="mx-auto grid max-w-md grid-cols-2 gap-4" style={vars} role="img" aria-label={`Mapa muscular: ${label}`}>
        <div dangerouslySetInnerHTML={{ __html: BODY_FRONT_SVG }} />
        <div dangerouslySetInnerHTML={{ __html: BODY_BACK_SVG }} />
      </div>
      <div className="mx-auto mt-3 flex max-w-xs items-center gap-2 text-xs text-muted" aria-hidden>
        <span>0</span>
        <span
          className="h-2 flex-1 rounded-full"
          style={{ background: "linear-gradient(to right, color-mix(in srgb, var(--accent) 10%, var(--surface-2)), var(--accent))" }}
        />
        <span>máximo semanal</span>
      </div>
    </div>
  );
}
