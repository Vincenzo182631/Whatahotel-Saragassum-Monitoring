// Wind-driven sargassum beaching forecast (transparent heuristic).
//
// Floating sargassum sitting offshore is pushed toward or away from a beach by
// the wind. Onshore wind (blowing from the sea toward land) drives accumulation;
// offshore wind clears it. We project the current 0-100 beach score forward
// using each day's dominant wind relative to the beach's offshore bearing,
// scaled by how much sargassum the current score implies is actually out there
// to be moved.
//
// This is a heuristic, not a validated numerical drift model — it captures the
// dominant driver (wind) from real free forecast data, and is clearly labeled.

import { tierFromScore, type BeachTier } from "@/lib/levels";

export interface DailyWind {
  date: string;
  windFromDeg: number; // direction the wind blows FROM
  /** Daily MEAN wind speed. K is calibrated against the mean, not the peak. */
  windKmh: number;
}

export interface ForecastDay {
  date: string;
  windFromDeg: number;
  windKmh: number;
  /** Onshore wind component in km/h (positive = pushing sargassum onto beach). */
  onshore: number;
  score: number;
  tier: BeachTier;
}

export type ForecastTrend = "improving" | "steady" | "worsening";

// Score points shed per km/h of onshore wind per day, against the daily MEAN
// wind speed. Calibrated from 0.3 (which was tuned against the daily maximum)
// by the mean/max ratio measured across all 18 monitored zones over 684
// zone-days of Open-Meteo data: r = 0.649, so 0.3 / 0.649 ≈ 0.46. Switching the
// input without this rescale would weaken every zone's outlook by ~35% and drop
// genuinely affected beaches out of the "worsening" band.
const K = 0.46;
const REVERT = 0.2; // daily pull back toward the current baseline (belt effect)

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Smallest angle between two bearings, 0..180. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
}

/**
 * Onshore component of the wind in km/h. Positive when the wind blows from the
 * sea (near the offshore bearing) toward land; negative when it blows offshore.
 */
export function onshoreComponent(
  windFromDeg: number,
  windKmh: number,
  offshoreBearing: number,
): number {
  return windKmh * Math.cos(deg2rad(angleDiff(windFromDeg, offshoreBearing)));
}

/**
 * Fraction of the wind's beaching effect that can actually be realised, 0..1.
 *
 * Onshore wind moves sargassum that is already floating offshore; it cannot
 * beach what isn't there. The score is the only measure we hold of how much is
 * around, so its distance from clean stands in for the available supply: a zone
 * reading 100 has nothing to push ashore however hard the wind blows onshore,
 * while a zone at 40 has plenty.
 */
export function availableSargassum(score: number): number {
  return (100 - clamp(score)) / 100;
}

/**
 * Project the current score across the daily wind outlook. Onshore days lower
 * the score (more beaching), offshore days raise it, with a gentle reversion so
 * the trajectory doesn't run away. The wind's effect is scaled by how much
 * sargassum is actually present — without that, a persistent onshore breeze
 * drags every zone's outlook down whether or not there is any seaweed in the
 * water, which reads as "worsening" for every east-facing Caribbean beach.
 */
export function projectForecast(
  currentScore: number,
  daily: DailyWind[],
  offshoreBearing: number,
): { days: ForecastDay[]; trend: ForecastTrend } {
  const base = clamp(currentScore);
  const available = availableSargassum(base);
  let score = base;
  const days: ForecastDay[] = [];

  for (const d of daily) {
    const onshore = onshoreComponent(d.windFromDeg, d.windKmh, offshoreBearing);
    let next = score - K * onshore * available;
    next = next + REVERT * (base - next);
    next = clamp(next);
    days.push({
      date: d.date,
      windFromDeg: Math.round(d.windFromDeg),
      windKmh: Math.round(d.windKmh),
      onshore: Math.round(onshore),
      score: Math.round(next),
      tier: tierFromScore(next),
    });
    score = next;
  }

  const end = days.length ? days[days.length - 1].score : base;
  const delta = end - base;
  const trend: ForecastTrend = delta >= 5 ? "improving" : delta <= -5 ? "worsening" : "steady";
  return { days, trend };
}

function clamp(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, v));
}
