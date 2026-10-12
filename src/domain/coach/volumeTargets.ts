export interface SetRange {
  min: number;
  max: number;
}

export type VolumeStatus = "muy_bajo" | "bajo" | "objetivo" | "alto";

/**
 * Weekly hard sets per muscle for hypertrophy. Orientative (dose–response meta-analyses): ~10–20 is the
 * productive zone, under ~6 barely maintains, over ~20 gives diminishing returns.
 */
export const DEFAULT_RANGE: SetRange = { min: 10, max: 20 };

/** Small or heavily indirectly-trained muscles need less. Edit here to tune the coach. */
export const RANGES: Record<string, SetRange> = {
  Core: { min: 6, max: 16 },
  Antebrazo: { min: 4, max: 12 },
  Gemelo: { min: 8, max: 16 },
};

export const rangeFor = (group: string): SetRange => RANGES[group] ?? DEFAULT_RANGE;

/** Under 60 % of the minimum is "muy bajo" (10 → <6). */
export function classify(sets: number, { min, max }: SetRange): VolumeStatus {
  if (sets < min * 0.6) return "muy_bajo";
  if (sets < min) return "bajo";
  if (sets <= max) return "objetivo";
  return "alto";
}
