import type { WorkoutSet } from "../schemas/workout";

/** Load actually moved in a set: added weight plus bodyweight for "(+ BW x kg)" exercises. */
export const setLoad = (s: WorkoutSet) => s.weight_kg + (s.bodyweight_kg ?? 0);

/** Volume of a set as Lyfta counts it: dumbbell sets count both dumbbells. */
export const setVolume = (s: WorkoutSet) => setLoad(s) * s.reps * (s.dumbbell_pair ? 2 : 1);
