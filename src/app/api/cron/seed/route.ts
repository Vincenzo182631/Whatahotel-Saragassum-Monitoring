import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { seedDatabase } from "@/lib/seed-data";
import { cronAuthError } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One-time (idempotent) database bootstrap: loads the curated beach zones and
 * hotels into the connected database. Useful on platforms where you can't run
 * `prisma db seed` locally against production.
 *
 * Protected by the `CRON_SECRET` bearer token, same as the update cron.
 */
async function handle(request: NextRequest) {
  const denied = cronAuthError(request);
  if (denied) return denied;

  try {
    const result = await seedDatabase();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Seed failed:", error);
    return NextResponse.json({ error: "Seed failed." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
