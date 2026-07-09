import type { BeachImportRecord } from "@/types/beach";

/**
 * A source of sargassum/beach-condition data.
 *
 * Providers are the extension point for Phase 2 data collection: implement
 * this interface for NOAA/USF fetchers, tourism feeds, user reports, etc.,
 * and register them in `src/lib/beach-update-job.ts`. Every provider returns
 * the same `BeachImportRecord[]` contract that `BeachDataService.importRecords`
 * consumes, so callers never change.
 */
export interface SargassumProvider {
  /** Human-readable id, stamped onto records as their `source`. */
  readonly name: string;

  /** Whether this provider is configured/enabled in the current environment. */
  isEnabled(): boolean;

  /** Fetch + analyze current conditions into import records. */
  fetch(): Promise<BeachImportRecord[]>;
}
