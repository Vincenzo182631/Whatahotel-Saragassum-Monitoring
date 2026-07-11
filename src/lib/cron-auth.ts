import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "@/lib/auth";

/**
 * Authorize a cron/maintenance request against `CRON_SECRET`.
 *
 * Returns an error response to send, or null when the request is authorized.
 * Fails CLOSED in production when the secret is missing — these endpoints can
 * mutate live data (seed overwrites scores), so "no secret configured" must
 * never mean "open to the internet". Unset secret is only allowed in dev.
 */
export function cronAuthError(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "CRON_SECRET is not configured." },
        { status: 503 },
      );
    }
    return null; // local dev only
  }

  const auth = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return null;
}
