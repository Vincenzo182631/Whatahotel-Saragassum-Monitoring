import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { BeachDataService } from "@/lib/beach-data-service";
import { serializeBeachZone } from "@/lib/serializers";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/admin/beaches/[id]
 * Manual admin override of a beach zone's risk (Feature 6).
 *
 * Body: { riskScore: number, statusDescription?: string, source?: string, notes?: string }
 *
 * Protected by `src/middleware.ts`, which gates all `/api/admin/*` routes
 * behind an authenticated admin session (see `src/lib/auth.ts`).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.riskScore !== "number") {
      return NextResponse.json(
        { error: "Body must include a numeric `riskScore`." },
        { status: 400 },
      );
    }

    const exists = await prisma.beachZone.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json(
        { error: "Beach zone not found." },
        { status: 404 },
      );
    }

    const zone = await BeachDataService.setZoneScore(params.id, body.riskScore, {
      statusDescription: body.statusDescription,
      source: body.source,
      notes: body.notes,
    });

    const withCount = await prisma.beachZone.findUnique({
      where: { id: zone.id },
      include: { _count: { select: { hotels: true } } },
    });

    return NextResponse.json({ beach: serializeBeachZone(withCount!) });
  } catch (error) {
    console.error(`PATCH /api/admin/beaches/${params.id} failed:`, error);
    return NextResponse.json(
      { error: "Failed to update beach zone." },
      { status: 500 },
    );
  }
}
