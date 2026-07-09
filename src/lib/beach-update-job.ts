import { BeachDataService } from "@/lib/beach-data-service";
import { FeedSargassumProvider } from "@/lib/providers/feed-provider";
import { SeasonalModelProvider } from "@/lib/providers/seasonal-provider";
import type { SargassumProvider } from "@/lib/providers/types";
import type { BeachImportRecord } from "@/types/beach";

export interface BeachUpdateResult {
  ranAt: string;
  source: string | null;
  status: "updated" | "skipped" | "error";
  imported: number;
  hotelsUpdated: number;
  message?: string;
}

/**
 * Phase 2 pipeline — the "every 12 hours" update job:
 *
 *   Fetch Data → Analyze Report → Assign Risk Score → Update Database → Update Hotels
 *
 * Providers are tried in priority order; the first enabled provider that
 * returns records wins. Risk levels and hotel condition caches are handled by
 * `BeachDataService.importRecords`, so this stays a thin orchestrator.
 */
export async function runBeachUpdate(
  providers?: SargassumProvider[],
): Promise<BeachUpdateResult> {
  const ranAt = new Date().toISOString();

  // Priority: live feed first, seasonal estimate as opt-in fallback.
  const chain = providers ?? [
    new FeedSargassumProvider(),
    new SeasonalModelProvider(),
  ];

  const enabled = chain.filter((p) => p.isEnabled());
  if (enabled.length === 0) {
    return {
      ranAt,
      source: null,
      status: "skipped",
      imported: 0,
      hotelsUpdated: 0,
      message:
        "No data source configured. Set SARGASSUM_FEED_URL or SARGASSUM_USE_SEASONAL_MODEL=true.",
    };
  }

  for (const provider of enabled) {
    let records: BeachImportRecord[];
    try {
      records = await provider.fetch();
    } catch (error) {
      console.error(`[beach-update] provider "${provider.name}" failed:`, error);
      continue; // try the next provider rather than corrupting data
    }

    if (records.length === 0) continue;

    const { imported, hotelsUpdated } =
      await BeachDataService.importRecords(records);

    console.log(
      `[beach-update] ${provider.name}: imported ${imported} zones, updated ${hotelsUpdated} hotels.`,
    );

    return {
      ranAt,
      source: provider.name,
      status: "updated",
      imported,
      hotelsUpdated,
    };
  }

  return {
    ranAt,
    source: null,
    status: "error",
    imported: 0,
    hotelsUpdated: 0,
    message: "All configured providers failed or returned no data.",
  };
}
