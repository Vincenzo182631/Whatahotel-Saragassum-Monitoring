import type { SargassumProvider } from "./types";
import type { BeachImportRecord } from "@/types/beach";
import { prisma } from "@/lib/prisma";
import { afaiToScore, median } from "@/lib/analysis/afai";

/**
 * USF/NOAA AFAI satellite provider — the real, free data source.
 *
 * Queries NOAA/AOML's CoastWatch ERDDAP for the 7-day cumulative USF AFAI
 * (Alternative Floating Algae Index, produced from USF satellite analysis).
 * For each beach zone it samples a small box around the coordinates, takes the
 * median AFAI over valid ocean pixels, and maps that to a 0-100 beach score.
 *
 * Enabled by default; disable with `SARGASSUM_AFAI_ENABLED=false`.
 * Data: https://cwcgom.aoml.noaa.gov/erddap  ·  https://optics.marine.usf.edu
 */
export class UsfNoaaAfaiProvider implements SargassumProvider {
  readonly name = "USF/NOAA AFAI (satellite)";

  private readonly baseUrl: string;
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
    baseUrl?: string;
    halfWindowDeg?: number;
    stride?: number;
    minValidPixels?: number;
    timeoutMs?: number;
  } = {}) {
    this.baseUrl =
      opts.baseUrl ??
      process.env.SARGASSUM_AFAI_ERDDAP ??
      "https://cwcgom.aoml.noaa.gov/erddap/griddap/noaa_aoml_atlantic_oceanwatch_AFAI_7D.csv";
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
          return {
            destination: z.name,
            riskScore: afaiToScore(sample.median),
            source: this.name,
            notes: `Median AFAI ${sample.median.toFixed(5)} over ${sample.count} valid pixels (7-day cumulative).`,
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
   * Sample the AFAI grid around a coordinate and return the median of valid
   * pixels. Exposed for testing. Returns null when too few valid pixels.
   */
  async sampleZone(
    latitude: number,
    longitude: number,
  ): Promise<{ median: number; count: number } | null> {
    const la1 = clamp(
      latitude - this.halfWindowDeg,
      UsfNoaaAfaiProvider.LAT_MIN,
      UsfNoaaAfaiProvider.LAT_MAX,
    );
    const la2 = clamp(
      latitude + this.halfWindowDeg,
      UsfNoaaAfaiProvider.LAT_MIN,
      UsfNoaaAfaiProvider.LAT_MAX,
    );
    const lo1 = clamp(
      longitude - this.halfWindowDeg,
      UsfNoaaAfaiProvider.LON_MIN,
      UsfNoaaAfaiProvider.LON_MAX,
    );
    const lo2 = clamp(
      longitude + this.halfWindowDeg,
      UsfNoaaAfaiProvider.LON_MIN,
      UsfNoaaAfaiProvider.LON_MAX,
    );

    const query =
      `AFAI[(last)][(${la1}):${this.stride}:(${la2})]` +
      `[(${lo1}):${this.stride}:(${lo2})]`;
    const url = `${this.baseUrl}?${query.replace(/\[/g, "%5B").replace(/\]/g, "%5D")}`;

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

    const m = median(values);
    if (m === null) return null;
    return { median: m, count: values.length };
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
