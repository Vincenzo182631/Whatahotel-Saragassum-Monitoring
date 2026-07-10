import type { SargassumProvider } from "./types";
import type { BeachImportRecord } from "@/types/beach";
import { densityToScore } from "@/lib/analysis/seasonal-model";
import { clampScore } from "@/lib/risk";

/**
 * Raw record shape expected from a public JSON feed. A feed may report either
 * an already-computed `riskScore` (0-100, higher = clearer) or a raw
 * `densityIndex` (0-1, higher = more sargassum) — this provider normalises both.
 */
interface FeedRecord {
  destination: string;
  riskScore?: number;
  densityIndex?: number;
  statusDescription?: string;
  notes?: string;
}

/**
 * Fetches beach conditions from a configurable public JSON feed
 * (`SARGASSUM_FEED_URL`). This is the intended production path: point it at an
 * aggregated NOAA/USF-derived feed. Network + parse errors are surfaced to the
 * caller so a failed run never silently corrupts data.
 */
export class FeedSargassumProvider implements SargassumProvider {
  readonly name: string;
  private readonly url?: string;
  private readonly timeoutMs: number;

  constructor(url = process.env.SARGASSUM_FEED_URL, timeoutMs = 15000) {
    this.url = url;
    this.timeoutMs = timeoutMs;
    this.name = process.env.SARGASSUM_FEED_NAME ?? "Public feed (USF/NOAA)";
  }

  isEnabled(): boolean {
    return Boolean(this.url);
  }

  async fetch(): Promise<BeachImportRecord[]> {
    if (!this.url) return [];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await globalThis.fetch(this.url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Feed responded ${res.status} ${res.statusText}`);
      }

      const payload = (await res.json()) as unknown;
      const rows = Array.isArray(payload)
        ? payload
        : (payload as { data?: unknown }).data;
      if (!Array.isArray(rows)) {
        throw new Error("Feed payload is not an array of records.");
      }

      return (rows as FeedRecord[])
        .filter((r) => typeof r?.destination === "string")
        .map((r) => this.normalise(r))
        .filter((r): r is BeachImportRecord => r !== null);
    } finally {
      clearTimeout(timer);
    }
  }

  private normalise(r: FeedRecord): BeachImportRecord | null {
    let score: number | undefined;
    if (typeof r.riskScore === "number") {
      score = clampScore(r.riskScore);
    } else if (typeof r.densityIndex === "number") {
      score = densityToScore(r.densityIndex);
    }
    if (score === undefined) return null;

    return {
      destination: r.destination,
      riskScore: score,
      statusDescription: r.statusDescription,
      notes: r.notes,
      source: this.name,
    };
  }
}
