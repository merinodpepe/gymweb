/** Weekly goals (optional env overrides). */
export const goals = {
  steps: Number(process.env.STEPS_GOAL ?? 10_000),
  weeklyRunKm: Number(process.env.WEEKLY_RUN_KM_GOAL ?? 15),
};
