import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { projectForecast, type DailyWind } from "@/lib/analysis/forecast";

/**
 * Beach Forecast service — a 7-day wind-driven beaching outlook per zone.
 *
 * Pulls the free NOAA/Open-Meteo daily wind forecast (no API key) and projects
 * each zone's current satellite score forward using onshore/offshore wind. It
 * never changes the current score; it stores a forward outlook + trend. Runs on
 * the same daily cadence as the satellite update.
 */

const DEFAULT_OFFSHORE_BEARING = 90; // east-facing (correct for most Caribbean beaches)
const FORECAST_DAYS = 7;
const TIMEOUT_MS = 12000;
// Open-Meteo's free tier rate-limits bursts, so process zones in small
// concurrency groups with a short pause between batches instead of firing all
// requests at once (which was silently dropping ~5 of 18 zones per run).
const BATCH_SIZE = 4;
const BATCH_PAUSE_MS = 400;
const FETCH_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface BeachForecastResult {
  ranAt: string;
  status: "updated" | "error";
  zonesForecast: number;
}

export async function refreshBeachForecasts(now: Date = new Date()): Promise<BeachForecastResult> {
  const ranAt = now.toISOString();
  const zones = await prisma.beachZone.findMany({
    select: { id: true, latitude: true, longitude: true, riskScore: true, offshoreBearing: true },
  });

  let count = 0;
  for (let i = 0; i < zones.length; i += BATCH_SIZE) {
    const batch = zones.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (z) => {
        try {
          const daily = await fetchWind(z.latitude, z.longitude);
          if (daily.length === 0) return;
          const { days, trend } = projectForecast(
            z.riskScore,
            daily,
            z.offshoreBearing ?? DEFAULT_OFFSHORE_BEARING,
          );
          await prisma.beachZone.update({
            where: { id: z.id },
            data: {
              forecast: days as unknown as Prisma.InputJsonValue,
              forecastTrend: trend,
              forecastCheckedAt: now,
            },
          });
          count += 1;
        } catch (error) {
          console.error(`[forecast] zone ${z.id} failed:`, error);
        }
      }),
    );
    if (i + BATCH_SIZE < zones.length) await sleep(BATCH_PAUSE_MS);
  }

  return { ranAt, status: "updated", zonesForecast: count };
}

async function fetchWind(latitude: number, longitude: number): Promise<DailyWind[]> {
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
    const out = await fetchWindOnce(latitude, longitude);
    if (out.length > 0) return out;
    // Transient miss (429 / timeout / empty) — back off briefly and retry.
    if (attempt < FETCH_RETRIES) await sleep(500 * (attempt + 1));
  }
  return [];
}

async function fetchWindOnce(latitude: number, longitude: number): Promise<DailyWind[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&daily=wind_speed_10m_max,wind_direction_10m_dominant&forecast_days=${FORECAST_DAYS}&timezone=auto`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await globalThis.fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      daily?: {
        time?: string[];
        wind_speed_10m_max?: number[];
        wind_direction_10m_dominant?: number[];
      };
    };
    const d = data.daily;
    if (!d?.time || !d.wind_speed_10m_max || !d.wind_direction_10m_dominant) return [];

    const out: DailyWind[] = [];
    for (let i = 0; i < d.time.length; i++) {
      const windKmh = d.wind_speed_10m_max[i];
      const windFromDeg = d.wind_direction_10m_dominant[i];
      if (typeof windKmh !== "number" || typeof windFromDeg !== "number") continue;
      out.push({ date: d.time[i], windKmh, windFromDeg });
    }
    return out;
  } catch {
    // Timeout/abort/network error — treat as a transient miss so the caller retries.
    return [];
  } finally {
    clearTimeout(timer);
  }
}
