import type { SargassumProvider } from "./types";
import type { BeachImportRecord } from "@/types/beach";
import { prisma } from "@/lib/prisma";
import { estimateBeachScore } from "@/lib/analysis/seasonal-model";

/**
 * Estimates each known zone's beach score from its latitude and the current
 * month using a transparent seasonal heuristic. Free, deterministic, and
 * requires no external service — the out-of-the-box fallback when no live feed
 * is configured.
 *
 * Enabled via `SARGASSUM_USE_SEASONAL_MODEL=true` (off by default so curated
 * data is never overwritten unless explicitly opted in).
 */
export class SeasonalModelProvider implements SargassumProvider {
  readonly name = "Seasonal model (estimate)";

  constructor(private readonly month: number = new Date().getUTCMonth()) {}

  isEnabled(): boolean {
    return process.env.SARGASSUM_USE_SEASONAL_MODEL === "true";
  }

  async fetch(): Promise<BeachImportRecord[]> {
    const zones = await prisma.beachZone.findMany({
      select: { name: true, latitude: true },
    });

    return zones.map((z) => ({
      destination: z.name,
      riskScore: estimateBeachScore(z.latitude, this.month),
      source: this.name,
      notes: `Seasonal estimate for month ${this.month + 1} (UTC).`,
    }));
  }
}
