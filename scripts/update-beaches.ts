/**
 * Manual / externally-scheduled entry point for the Phase 2 beach update job.
 *
 *   npm run beaches:update            # use configured providers
 *   npm run beaches:update -- --seasonal   # force the seasonal model
 *
 * Use this with any cron scheduler (system cron, GitHub Actions, etc.) if you
 * are not deploying on a platform with built-in cron.
 */
import { runBeachUpdate } from "../src/lib/beach-update-job";
import { SeasonalModelProvider } from "../src/lib/providers/seasonal-provider";
import { FeedSargassumProvider } from "../src/lib/providers/feed-provider";

async function main() {
  const forceSeasonal = process.argv.includes("--seasonal");

  const result = forceSeasonal
    ? await runBeachUpdate([
        new FeedSargassumProvider(),
        // Force-enable the seasonal model regardless of env flag.
        Object.assign(new SeasonalModelProvider(), { isEnabled: () => true }),
      ])
    : await runBeachUpdate();

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "error" ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
