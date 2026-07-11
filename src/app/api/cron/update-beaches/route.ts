import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runBeachUpdate } from "@/lib/beach-update-job";
import { refreshBeachNews } from "@/lib/services/beach-news";
import { refreshBeachForecasts } from "@/lib/services/beach-forecast";
import { cronAuthError } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
// Sargassum data changes slowly; allow a generous window for the job.
export const maxDuration = 60;

/**
 * Scheduled beach-condition refresh (Phase 2). Intended to run every 12 hours.
 *
 * Auth: if `CRON_SECRET` is set, the request must carry
 * `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this automatically).
 * If it is unset the route runs unprotected — acceptable for local dev only.
 *
 * Exposed as both GET (Vercel Cron) and POST (manual / other schedulers).
 */
async function handle(request: NextRequest) {
  const denied = cronAuthError(request);
  if (denied) return denied;

  try {
    const result = await runBeachUpdate();
    // News/announcement check (context + early-warning flag; never changes the
    // satellite score). Failures here must not fail the satellite update.
    const news = await refreshBeachNews().catch((e) => {
      console.error("Beach news refresh failed:", e);
      return null;
    });
    // Wind-driven 7-day beaching forecast (free Open-Meteo). Failure-isolated.
    const forecast = await refreshBeachForecasts().catch((e) => {
      console.error("Beach forecast refresh failed:", e);
      return null;
    });
    const status = result.status === "error" ? 502 : 200;
    return NextResponse.json({ ...result, news, forecast }, { status });
  } catch (error) {
    console.error("Beach update job crashed:", error);
    return NextResponse.json(
      { error: "Beach update job failed." },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
