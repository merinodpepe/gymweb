"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const KEY = "gymweb:lyfta-sync";
const EVERY_MS = 10 * 60_000;

/** Pulls new Lyfta workouts and Google Health steps when the app is opened (at most every 10 minutes) and refreshes if any arrived. */
export function AutoSync() {
  const router = useRouter();
  useEffect(() => {
    let last = 0;
    try {
      last = Number(localStorage.getItem(KEY)) || 0;
    } catch {}
    if (Date.now() - last < EVERY_MS) return;
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
    const json = (r: Response) => (r.ok ? r.json() : null);
    Promise.all([
      fetch("/api/sync-lyfta", { method: "POST" }).then(json).catch(() => null),
      // 409-style "not connected" answers are errors here and are simply ignored.
      fetch("/api/google/sync", { method: "POST" }).then(json).catch(() => null),
    ]).then(([lyfta, google]: [{ created?: number } | null, { steps_updated?: number } | null]) => {
      if (lyfta?.created || google?.steps_updated) router.refresh();
    });
  }, [router]);
  return null;
}
