import { mean } from "../stats/util";
import { tonnage } from "../stats/volume";
import { addDays } from "../stats/weeks";
import {
  exerciseSeries,
  type InsightData,
  lastCompleteWeek,
  weekEnd,
  weeklyKm,
  weeklyWeightChange,
} from "./data";

export interface Alert {
  id: "descarga" | "pasos" | "km-peso";
  level: "info" | "warn";
  text: string;
}

const fmt1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString("es-ES");

/** 3 weeks of clearly higher volume than the 4 before, with no exercise setting a new e1RM best. */
function deloadAlert(d: InsightData): Alert | null {
  const last = lastCompleteWeek(d.today);
  const recentStart = addDays(last, -14);
  const baseStart = addDays(recentStart, -28);
  const ton = (from: string, to: string) =>
    d.sessions.filter((s) => s.date.slice(0, 10) >= from && s.date.slice(0, 10) <= to).reduce((t, s) => t + tonnage(s.sets), 0);
  const recent = ton(recentStart, weekEnd(last)) / 3;
  const base = ton(baseStart, addDays(recentStart, -1)) / 4;
  if (base <= 0 || recent < base * 1.15) return null;

  let tested = 0;
  for (const s of exerciseSeries(d.sessions)) {
    const inWindow = s.points.filter((p) => p.date >= recentStart && p.date <= weekEnd(last));
    const before = s.points.filter((p) => p.date < recentStart);
    if (inWindow.length < 2 || !before.length) continue;
    tested++;
    if (Math.max(...inWindow.map((p) => p.value)) > Math.max(...before.map((p) => p.value))) return null;
  }
  return tested >= 2
    ? { id: "descarga", level: "warn", text: "Llevas 3 semanas con volumen alto y el e1RM no sube: posible descarga." }
    : null;
}

/** Steps of the last 7 days against the mean of the 28 days before them. */
function stepsAlert(d: InsightData): Alert | null {
  const recentFrom = addDays(d.today, -6);
  const baseFrom = addDays(recentFrom, -28);
  const recent = d.steps.filter((s) => s.date >= recentFrom && s.date <= d.today).map((s) => s.value);
  const base = d.steps.filter((s) => s.date >= baseFrom && s.date < recentFrom).map((s) => s.value);
  if (recent.length < 4 || base.length < 14) return null;
  const change = mean(recent) / mean(base) - 1;
  return change <= -0.3
    ? { id: "pasos", level: "warn", text: `Tus pasos bajaron un ${Math.round(-change * 100)} % esta semana respecto a tu media de las 4 semanas anteriores.` }
    : null;
}

/** Last complete week's km against the mean of the 4 weeks before it, with the weight change of that week. */
function kmWeightAlert(d: InsightData): Alert | null {
  const km = weeklyKm(d.runs, d.today);
  const last = lastCompleteWeek(d.today);
  const thisKm = km.get(last);
  const prior = [1, 2, 3, 4].map((i) => km.get(addDays(last, -7 * i))).filter((v): v is number => v !== undefined);
  if (thisKm === undefined || prior.length < 3) return null;
  const avg = mean(prior);
  const diff = thisKm - avg;
  if (avg <= 0 || Math.abs(diff) < Math.max(2, avg * 0.25)) return null;
  const weight = weeklyWeightChange(d.weights, d.today).find((w) => w.week_start === last);
  const more = diff > 0 ? "más" : "menos";
  const w = weight ? ` y tu peso ${weight.change_kg < 0 ? "bajó" : weight.change_kg > 0 ? "subió" : "no cambió"}${weight.change_kg === 0 ? "" : ` ${fmt1(Math.abs(weight.change_kg))} kg`}` : "";
  return { id: "km-peso", level: "info", text: `La semana pasada corriste ${fmt1(Math.abs(diff))} km ${more} que tu media${w}. Coincidencia observada, no causa.` };
}

export function buildAlerts(d: InsightData): Alert[] {
  return [deloadAlert(d), stepsAlert(d), kmWeightAlert(d)].filter((a): a is Alert => a !== null);
}

