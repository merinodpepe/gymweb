/** Dataset row: [name, ExerciseDB target muscle, equipment, secondary muscles]. */
export type DatasetRow = readonly [name: string, target: string, equipment: string, secondary: readonly string[]];

export interface MuscleMatch {
  group: string | null;
  /** Other app groups the exercise also works (indirect volume), never including `group`. */
  secondary: string[];
  match: "exact" | "similar" | "none";
}

export const MUSCLE_GROUPS = [
  "Pecho",
  "Espalda",
  "Hombro",
  "Bíceps",
  "Tríceps",
  "Cuádriceps",
  "Isquios",
  "Glúteo",
  "Gemelo",
  "Core",
  "Antebrazo",
] as const;

/** ExerciseDB `target` → app muscle group. Targets not listed (cardio, spine…) give no group. */
const TARGET_TO_GROUP: Record<string, string> = {
  pectorals: "Pecho",
  lats: "Espalda",
  "upper back": "Espalda",
  traps: "Espalda",
  "levator scapulae": "Espalda",
  delts: "Hombro",
  biceps: "Bíceps",
  triceps: "Tríceps",
  quads: "Cuádriceps",
  hamstrings: "Isquios",
  glutes: "Glúteo",
  abductors: "Glúteo",
  calves: "Gemelo",
  abs: "Core",
  forearms: "Antebrazo",
};

/** ExerciseDB secondary-muscle names → app muscle group. Others (lower back, hip flexors…) are ignored. */
const SECONDARY_TO_GROUP: Record<string, string> = {
  chest: "Pecho",
  "upper chest": "Pecho",
  back: "Espalda",
  "upper back": "Espalda",
  lats: "Espalda",
  "latissimus dorsi": "Espalda",
  rhomboids: "Espalda",
  trapezius: "Espalda",
  traps: "Espalda",
  shoulders: "Hombro",
  deltoids: "Hombro",
  "rear deltoids": "Hombro",
  biceps: "Bíceps",
  brachialis: "Bíceps",
  triceps: "Tríceps",
  quadriceps: "Cuádriceps",
  hamstrings: "Isquios",
  glutes: "Glúteo",
  calves: "Gemelo",
  soleus: "Gemelo",
  core: "Core",
  obliques: "Core",
  abdominals: "Core",
  "lower abs": "Core",
  forearms: "Antebrazo",
};

/** Words that vary between Lyfta and ExerciseDB without changing the muscle worked. */
const NOISE = new Set(["with", "rope", "cable", "wide", "grip", "standing", "kneeling", "the", "a"]);
const MIN_SIMILARITY = 0.6;

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
const tokens = (s: string) =>
  norm(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((t) => (t.length > 3 ? t.replace(/s$/, "") : t));

interface Consensus {
  group: string;
  secondary: string[];
}

/** Most common group among the candidates; ties go to the shortest-named candidate. */
function consensus(cands: DatasetRow[]): Consensus | null {
  const votes = new Map<string, number>();
  for (const [, target] of cands) {
    const g = TARGET_TO_GROUP[target];
    if (g) votes.set(g, (votes.get(g) ?? 0) + 1);
  }
  const top = Math.max(0, ...votes.values());
  if (!top) return null;
  const best = cands
    .filter(([, t]) => votes.get(TARGET_TO_GROUP[t] ?? "") === top)
    .sort((a, b) => a[0].length - b[0].length)[0];
  const group = TARGET_TO_GROUP[best[1]];
  if (!group) return null;
  const secondary = [...new Set(best[3].map((m) => SECONDARY_TO_GROUP[m]).filter((g): g is string => !!g && g !== group))];
  return { group, secondary };
}

/** Pure matcher: exact name → all words contained → enough meaningful words contained → none. */
export function matchMuscle(rawName: string, dataset: readonly DatasetRow[]): MuscleMatch {
  const none: MuscleMatch = { group: null, secondary: [], match: "none" };
  const name = norm(rawName);
  const exact = dataset.filter(([n]) => norm(n) === name);
  if (exact.length) {
    const c = consensus(exact);
    if (c) return { ...c, match: "exact" };
  }

  const q = new Set(tokens(rawName));
  if (!q.size) return none;
  const rows = dataset.map((r) => ({ r, t: new Set(tokens(r[0])) }));

  const all = rows.filter(({ t }) => [...q].every((w) => t.has(w))).map(({ r }) => r);
  const g1 = all.length ? consensus(all) : null;
  if (g1) return { ...g1, match: "similar" };

  const key = [...q].filter((w) => !NOISE.has(w));
  if (!key.length) return none;
  const scored = rows
    .map(({ r, t }) => ({ r, s: key.filter((w) => t.has(w)).length / key.length }))
    .filter(({ s }) => s >= MIN_SIMILARITY);
  if (!scored.length) return none;
  const top = Math.max(...scored.map(({ s }) => s));
  const g2 = consensus(scored.filter(({ s }) => s === top).map(({ r }) => r));
  return g2 ? { ...g2, match: "similar" } : none;
}
