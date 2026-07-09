/**
 * Manual / externally-scheduled entry point for the Phase 2 beach update job.
 *
 *   npm run beaches:update              # use configured providers (AFAI by default)
 *   npm run beaches:update -- --afai      # force the USF/NOAA satellite provider
 *   npm run beaches:update -- --seasonal  # force the seasonal model
 *
 * Use this with any cron scheduler (system cron, GitHub Actions, etc.) if you
 * are not deploying on a platform with built-in cron.
 */
import { runBeachUpdate } from "../src/lib/beach-update-job";
import { SeasonalModelProvider } from "../src/lib/providers/seasonal-provider";
import { UsfNoaaAfaiProvider } from "../src/lib/providers/usf-noaa-afai";
import { FeedSargassumProvider } from "../src/lib/providers/feed-provider";

async function main() {
  let providers;
  if (process.argv.includes("--seasonal")) {
    providers = [
      Object.assign(new SeasonalModelProvider(), { isEnabled: () => true }),
    ];
  } else if (process.argv.includes("--afai")) {
    providers = [
      Object.assign(new UsfNoaaAfaiProvider(), { isEnabled: () => true }),
    ];
  }

  const result = providers
    ? await runBeachUpdate(providers)
    : await runBeachUpdate();

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "error" ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
