import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeBeachZone } from "@/lib/serializers";

/**
 * GET /api/beaches/[id]
 * Returns a specific beach zone with its connected hotels.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const zone = await prisma.beachZone.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { hotels: true } },
        hotels: {
          select: { id: true, name: true, slug: true, city: true, rating: true },
          orderBy: { name: "asc" },
        },
        reports: {
          where: { relevant: true },
          orderBy: { publishedAt: "desc" },
          take: 6,
        },
      },
    });

    if (!zone) {
      return NextResponse.json(
        { error: "Beach zone not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      beach: serializeBeachZone(zone),
      hotels: zone.hotels,
      reports: zone.reports.map((r) => ({
        headline: r.headline,
        url: r.url,
        source: r.source,
        publishedAt: r.publishedAt.toISOString(),
        severity: r.severity,
        summary: r.summary,
      })),
    });
  } catch (error) {
    console.error(`GET /api/beaches/${params.id} failed:`, error);
    return NextResponse.json(
      { error: "Failed to load beach zone." },
      { status: 500 },
    );
  }
}
