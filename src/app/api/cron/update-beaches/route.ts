import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runBeachUpdate } from "@/lib/beach-update-job";

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
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  try {
    const result = await runBeachUpdate();
    const status = result.status === "error" ? 502 : 200;
    return NextResponse.json(result, { status });
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
