import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeBeachZone } from "@/lib/serializers";
import type { RiskLevel } from "@/lib/risk";

export const dynamic = "force-dynamic";

const RISK_LEVELS: RiskLevel[] = ["LOW", "MODERATE", "HIGH"];

/**
 * GET /api/beaches
 * Returns all beach conditions.
 *
 * Query params:
 *   country   - filter by country (case-insensitive)
 *   riskLevel - LOW | MODERATE | HIGH
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get("country");
    const riskLevelParam = searchParams.get("riskLevel")?.toUpperCase();

    const riskLevel =
      riskLevelParam && RISK_LEVELS.includes(riskLevelParam as RiskLevel)
        ? (riskLevelParam as RiskLevel)
        : undefined;

    const zones = await prisma.beachZone.findMany({
      where: {
        ...(country
          ? { country: { equals: country, mode: "insensitive" } }
          : {}),
        ...(riskLevel ? { riskLevel } : {}),
      },
      include: { _count: { select: { hotels: true } } },
      orderBy: [{ riskScore: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({ beaches: zones.map(serializeBeachZone) });
  } catch (error) {
    console.error("GET /api/beaches failed:", error);
    return NextResponse.json(
      { error: "Failed to load beach conditions." },
      { status: 500 },
    );
  }
}
