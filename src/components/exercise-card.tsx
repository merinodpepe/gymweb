import type { WorkoutSet } from "@/domain/schemas/workout";
import { setE1rm, isE1rmEligible } from "@/domain/stats/e1rm";
import { cn } from "@/lib/cn";
import { fmt, fmtKg } from "@/lib/format";

export function SetRow({ set, index }: { set: WorkoutSet; index: number }) {
  return (
    <li className={cn("flex items-center gap-3 py-1.5 text-sm", set.is_warmup && "text-muted")}>
      <span className="w-14 text-xs uppercase tracking-wide text-muted">Serie {index + 1}</span>
      <span className={cn("num", !set.is_warmup && "text-strong")}>
        {fmtKg(set.weight_kg)} kg × {set.reps}
      </span>
      {set.is_warmup ? (
        <span className="text-xs italic">calentamiento</span>
      ) : isE1rmEligible(set) ? (
        <span className="ml-auto text-xs text-muted num">e1RM {fmt(setE1rm(set.weight_kg, set.reps), 1)}</span>
      ) : null}
    </li>
  );
}

export function ExerciseCard({
  name,
  canonical,
  notes,
  sets,
}: {
  name: string;
  canonical?: string;
  notes: string | null;
  sets: WorkoutSet[];
}) {
  return (
    <article className="rounded-md border border-border bg-bg/40 p-3">
      <h3 className="font-display text-sm text-strong">{name}</h3>
      {canonical && canonical !== name && <p className="text-xs text-muted">→ {canonical}</p>}
      {notes && <p className="mt-1 whitespace-pre-line text-xs italic text-muted">{notes}</p>}
      {sets.length ? (
        <ol className="mt-2 divide-y divide-border/60">
          {sets.map((s, i) => (
            <SetRow key={i} set={s} index={i} />
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-xs text-bad">Sin series</p>
      )}
    </article>
  );
}
