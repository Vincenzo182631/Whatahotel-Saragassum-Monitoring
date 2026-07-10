import type { SargassumProvider } from "./types";
import type { BeachImportRecord } from "@/types/beach";
import { prisma } from "@/lib/prisma";
import { afaiToScore, median } from "@/lib/analysis/afai";

/**
 * USF/NOAA AFAI satellite provider — the real, free data source.
 *
 * Queries NOAA/AOML's CoastWatch ERDDAP for the USF AFAI (Alternative Floating
 * Algae Index, produced from USF satellite analysis). For each beach zone it
 * samples a small box around the coordinates, discards saturated pixels (which
 * are dominated by cloud / sun-glint contamination, per USF), takes the median
 * AFAI over the clean pixels, and maps that to a 0-100 beach score.
 *
 * Robustness: AFAI saturates under clouds, sun glint and thick aerosols, so a
 * fully-clouded box can read as a false "heavy sargassum". Two guards:
 *   1. Saturation filter — pixels at/above SATURATION_CAP are dropped before
 *      the median is taken (a genuine sargassum patch shows a spread of
 *      high-but-varied values, not a whole box pegged at the sensor cap).
 *   2. Multi-temporal fallback — if a window has too few clean pixels to trust
 *      (heavy cloud), fall back 7-day → 3-day → 1-day. If none yields a clean
 *      read, the zone is skipped and keeps its last good value rather than
 *      being overwritten with a cloud artifact.
 *
 * Enabled by default; disable with `SARGASSUM_AFAI_ENABLED=false`.
 * Data: https://cwcgom.aoml.noaa.gov/erddap  ·  https://optics.marine.usf.edu
 */

/** AFAI values at/above this are treated as saturated (cloud/glint), not signal. */
export const SATURATION_CAP = 0.00395;

interface DatasetWindow {
  label: string;
  url: string;
}

const ERDDAP_BASE =
  "https://cwcgom.aoml.noaa.gov/erddap/griddap/noaa_aoml_atlantic_oceanwatch_AFAI";

/** Default multi-temporal dataset chain (most stable coverage first). */
const DEFAULT_WINDOWS: DatasetWindow[] = [
  { label: "7-day", url: `${ERDDAP_BASE}_7D.csv` },
  { label: "3-day", url: `${ERDDAP_BASE}_3D.csv` },
  { label: "1-day", url: `${ERDDAP_BASE}.csv` },
];

interface ZoneSample {
  median: number;
  /** Clean (non-saturated) pixel count the median was computed from. */
  count: number;
  /** Total valid pixels sampled (clean + saturated). */
  total: number;
  /** Fraction of valid pixels that were saturated (cloud/glint suspicion). */
  saturatedFraction: number;
  /** Which temporal window produced this reading. */
  window: string;
}

export class UsfNoaaAfaiProvider implements SargassumProvider {
  readonly name = "USF/NOAA AFAI (satellite)";

  private readonly windows: DatasetWindow[];
  private readonly halfWindowDeg: number;
  private readonly stride: number;
  private readonly minValidPixels: number;
  private readonly timeoutMs: number;

  // Dataset bounds (see the ERDDAP .das): lat 0..38, lon -98..-38.
  private static readonly LAT_MIN = 0;
  private static readonly LAT_MAX = 38;
  private static readonly LON_MIN = -98;
  private static readonly LON_MAX = -38;

  constructor(opts: {
    windows?: DatasetWindow[];
    halfWindowDeg?: number;
    stride?: number;
    minValidPixels?: number;
    timeoutMs?: number;
  } = {}) {
    // A single-endpoint override (env or opt) disables the multi-temporal chain.
    const override = process.env.SARGASSUM_AFAI_ERDDAP;
    this.windows =
      opts.windows ??
      (override ? [{ label: "custom", url: override }] : DEFAULT_WINDOWS);
    this.halfWindowDeg = opts.halfWindowDeg ?? 0.2;
    this.stride = opts.stride ?? 5;
    this.minValidPixels = opts.minValidPixels ?? 4;
    this.timeoutMs = opts.timeoutMs ?? 20000;
  }

  isEnabled(): boolean {
    return process.env.SARGASSUM_AFAI_ENABLED !== "false";
  }

  async fetch(): Promise<BeachImportRecord[]> {
    const zones = await prisma.beachZone.findMany({
      select: { name: true, latitude: true, longitude: true },
    });

    const results = await Promise.all(
      zones.map(async (z): Promise<BeachImportRecord | null> => {
        try {
          const sample = await this.sampleZone(z.latitude, z.longitude);
          if (!sample) return null;
          const cloudNote =
            sample.saturatedFraction >= 0.25
              ? `, ${Math.round(sample.saturatedFraction * 100)}% cloud/glint-filtered`
              : "";
          return {
            destination: z.name,
            riskScore: afaiToScore(sample.median),
            source: this.name,
            notes: `Median AFAI ${sample.median.toFixed(5)} over ${sample.count} clean px (${sample.window}${cloudNote}).`,
          };
        } catch (error) {
          console.error(`[afai] "${z.name}" sample failed:`, error);
          return null;
        }
      }),
    );

    return results.filter((r): r is BeachImportRecord => r !== null);
  }

  /**
   * Sample the AFAI grid around a coordinate. Tries each temporal window in
   * order and returns the first clean read (enough non-saturated pixels), or
   * null if every window is too cloudy. Exposed for testing.
   */
  async sampleZone(
    latitude: number,
    longitude: number,
  ): Promise<ZoneSample | null> {
    for (const window of this.windows) {
      try {
        const sample = await this.sampleFromWindow(window, latitude, longitude);
        if (sample) return sample;
      } catch (error) {
        // Try the next window on any per-window failure (timeout, 5xx, parse).
        console.error(`[afai] window "${window.label}" failed:`, error);
      }
    }
    return null;
  }

  private async sampleFromWindow(
    window: DatasetWindow,
    latitude: number,
    longitude: number,
  ): Promise<ZoneSample | null> {
    const la1 = clamp(latitude - this.halfWindowDeg, UsfNoaaAfaiProvider.LAT_MIN, UsfNoaaAfaiProvider.LAT_MAX);
    const la2 = clamp(latitude + this.halfWindowDeg, UsfNoaaAfaiProvider.LAT_MIN, UsfNoaaAfaiProvider.LAT_MAX);
    const lo1 = clamp(longitude - this.halfWindowDeg, UsfNoaaAfaiProvider.LON_MIN, UsfNoaaAfaiProvider.LON_MAX);
    const lo2 = clamp(longitude + this.halfWindowDeg, UsfNoaaAfaiProvider.LON_MIN, UsfNoaaAfaiProvider.LON_MAX);

    const query =
      `AFAI[(last)][(${la1}):${this.stride}:(${la2})]` +
      `[(${lo1}):${this.stride}:(${lo2})]`;
    const url = `${window.url}?${query.replace(/\[/g, "%5B").replace(/\]/g, "%5D")}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let csv: string;
    try {
      const res = await globalThis.fetch(url, {
        signal: controller.signal,
        headers: { Accept: "text/csv" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`ERDDAP responded ${res.status}`);
      csv = await res.text();
    } finally {
      clearTimeout(timer);
    }

    const values = parseAfaiCsv(csv);
    if (values.length < this.minValidPixels) return null;

    // Drop saturated pixels (cloud / sun-glint contamination) before averaging.
    const clean = values.filter((v) => v < SATURATION_CAP);
    if (clean.length < this.minValidPixels) return null; // too cloudy to trust

    const m = median(clean);
    if (m === null) return null;

    return {
      median: m,
      count: clean.length,
      total: values.length,
      saturatedFraction: (values.length - clean.length) / values.length,
      window: window.label,
    };
  }
}

/** Parse ERDDAP griddap CSV, returning finite AFAI values (drops NaN/land). */
export function parseAfaiCsv(csv: string): number[] {
  const values: number[] = [];
  const lines = csv.split("\n");
  // Line 0 = column names, line 1 = units; data starts at line 2.
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const last = line.slice(line.lastIndexOf(",") + 1).trim();
    const n = Number(last);
    if (Number.isFinite(n)) values.push(n);
  }
  return values;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
