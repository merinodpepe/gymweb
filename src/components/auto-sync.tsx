"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const KEY = "gymweb:lyfta-sync";
const EVERY_MS = 10 * 60_000;

/** Pulls new Lyfta workouts when the app is opened (at most every 10 minutes) and refreshes if any arrived. */
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
    fetch("/api/sync-lyfta", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((r: { created?: number } | null) => {
        if (r?.created) router.refresh();
      })
      .catch(() => {});
  }, [router]);
  return null;
}
