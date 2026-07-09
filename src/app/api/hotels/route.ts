import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { RiskLevel } from "@/lib/risk";

export const dynamic = "force-dynamic";

const RISK_LEVELS: RiskLevel[] = ["LOW", "MODERATE", "HIGH"];

/**
 * GET /api/hotels
 * Hotel search with Beach Intelligence integration (Feature 4).
 *
 * Query params:
 *   q          - free-text match on hotel name / city
 *   city       - filter by city (case-insensitive)
 *   country    - filter by country (case-insensitive)
 *   riskLevel  - repeatable; LOW | MODERATE | HIGH (e.g. ?riskLevel=LOW&riskLevel=MODERATE)
 *   minScore   - only hotels with beach score >= minScore
 *   sort       - "beach" (default, best beach first) | "price" | "rating"
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const city = searchParams.get("city")?.trim();
    const country = searchParams.get("country")?.trim();
    const minScoreRaw = searchParams.get("minScore");
    const minScore = minScoreRaw ? parseInt(minScoreRaw, 10) : undefined;
    const sort = searchParams.get("sort") ?? "beach";

    const riskLevels = searchParams
      .getAll("riskLevel")
      .map((r) => r.toUpperCase())
      .filter((r): r is RiskLevel => RISK_LEVELS.includes(r as RiskLevel));

    const conditionFilter: Prisma.HotelBeachConditionWhereInput = {};
    if (riskLevels.length > 0) conditionFilter.riskLevel = { in: riskLevels };
    if (minScore !== undefined && !Number.isNaN(minScore)) {
      conditionFilter.riskScore = { gte: minScore };
    }

    const where: Prisma.HotelWhereInput = {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
      ...(country ? { country: { equals: country, mode: "insensitive" } } : {}),
      ...(Object.keys(conditionFilter).length > 0
        ? { condition: { is: conditionFilter } }
        : {}),
    };

    const hotels = await prisma.hotel.findMany({
      where,
      include: {
        condition: {
          include: { beachZone: { select: { name: true } } },
        },
      },
    });

    const results = hotels.map((h) => ({
      id: h.id,
      name: h.name,
      slug: h.slug,
      city: h.city,
      country: h.country,
      pricePerNight: h.pricePerNight,
      rating: h.rating,
      imageUrl: h.imageUrl,
      beach: h.condition
        ? {
            zone: h.condition.beachZone.name,
            score: h.condition.riskScore,
            level: h.condition.riskLevel,
          }
        : null,
    }));

    results.sort((a, b) => {
      if (sort === "price") {
        return (a.pricePerNight ?? Infinity) - (b.pricePerNight ?? Infinity);
      }
      if (sort === "rating") {
        return (b.rating ?? 0) - (a.rating ?? 0);
      }
      // default: best beach conditions first
      return (b.beach?.score ?? -1) - (a.beach?.score ?? -1);
    });

    return NextResponse.json({ hotels: results, count: results.length });
  } catch (error) {
    console.error("GET /api/hotels failed:", error);
    return NextResponse.json(
      { error: "Failed to search hotels." },
      { status: 500 },
    );
  }
}
