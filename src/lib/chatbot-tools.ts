import { prisma } from "@/lib/prisma";
import { riskMeta, type RiskLevel } from "@/lib/risk";

export interface BeachConditionResult {
  destination: string;
  matchedZone: string;
  riskScore: number;
  riskLevel: RiskLevel;
  summary: string;
  /** Nearby zones with better beach conditions, if this one is risky. */
  alternatives: { destination: string; riskScore: number; riskLevel: RiskLevel }[];
  /** Early-warning flag: recent news indicates worse conditions than satellite. */
  newsFlag: boolean;
  /** One-line reason for the flag (headline + source), when flagged. */
  newsSummary: string | null;
  /** Most recent relevant news item, if any. */
  latestReport: {
    headline: string;
    source: string;
    publishedAt: string;
    severity: RiskLevel | null;
    summary: string | null;
  } | null;
}

export interface HotelBeachRanking {
  name: string;
  slug: string;
  city: string;
  beachScore: number;
  riskLevel: RiskLevel;
}

/**
 * Chatbot tool: getBeachCondition(destination)  (Feature 5).
 *
 * Looks up a destination's beach zone (fuzzy, case-insensitive), summarises
 * its current sargassum risk, and — when the zone is not LOW risk — suggests
 * nearby zones with better conditions.
 */
export async function getBeachCondition(
  destination: string,
): Promise<BeachConditionResult | null> {
  const zone = await prisma.beachZone.findFirst({
    where: { name: { contains: destination.trim(), mode: "insensitive" } },
    orderBy: { riskScore: "desc" },
    include: {
      reports: {
        where: { relevant: true, severity: { not: null } },
        orderBy: { publishedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!zone) return null;

  let alternatives: BeachConditionResult["alternatives"] = [];
  if (zone.riskLevel !== "LOW") {
    const better = await prisma.beachZone.findMany({
      where: {
        country: zone.country,
        riskScore: { gt: zone.riskScore },
        NOT: { id: zone.id },
      },
      orderBy: { riskScore: "desc" },
      take: 3,
    });
    alternatives = better.map((b) => ({
      destination: b.name,
      riskScore: b.riskScore,
      riskLevel: b.riskLevel,
    }));
  }

  const meta = riskMeta(zone.riskLevel);
  const summary =
    zone.riskLevel === "LOW"
      ? `${zone.name} currently has a low likelihood of sargassum impact (beach score ${zone.riskScore}/100).`
      : `${zone.name} currently has a ${meta.label.toLowerCase()} of sargassum impact (beach score ${zone.riskScore}/100).`;

  const report = zone.reports[0];
  return {
    destination,
    matchedZone: zone.name,
    riskScore: zone.riskScore,
    riskLevel: zone.riskLevel,
    summary,
    alternatives,
    newsFlag: zone.newsFlag,
    newsSummary: zone.newsSummary,
    latestReport: report
      ? {
          headline: report.headline,
          source: report.source,
          publishedAt: report.publishedAt.toISOString(),
          severity: report.severity,
          summary: report.summary,
        }
      : null,
  };
}

/**
 * Chatbot tool: rank the beachfront hotels in a destination by beach score.
 * Powers answers like "Which Cancun hotels have the best beaches?".
 */
export async function rankHotelsByBeach(
  destination: string,
  limit = 5,
): Promise<HotelBeachRanking[]> {
  const term = destination.trim();
  const hotels = await prisma.hotel.findMany({
    where: {
      OR: [
        { city: { contains: term, mode: "insensitive" } },
        { beachZone: { name: { contains: term, mode: "insensitive" } } },
        { beachZone: { country: { contains: term, mode: "insensitive" } } },
      ],
      condition: { isNot: null },
    },
    include: { condition: true },
    take: 50,
  });

  return hotels
    .filter((h) => h.condition)
    .sort((a, b) => (b.condition!.riskScore) - (a.condition!.riskScore))
    .slice(0, limit)
    .map((h) => ({
      name: h.name,
      slug: h.slug,
      city: h.city,
      beachScore: h.condition!.riskScore,
      riskLevel: h.condition!.riskLevel,
    }));
}

/**
 * OpenAI/Anthropic-style tool definitions the WhataHotel chatbot can expose.
 * Kept here so the chat layer imports a single source of truth.
 */
export const beachIntelligenceTools = [
  {
    name: "getBeachCondition",
    description:
      "Get the current sargassum beach condition for a destination, with safer nearby alternatives when relevant.",
    parameters: {
      type: "object",
      properties: {
        destination: {
          type: "string",
          description: "Destination or beach zone name, e.g. 'Cancun' or 'Tulum'.",
        },
      },
      required: ["destination"],
    },
  },
  {
    name: "rankHotelsByBeach",
    description:
      "Rank beachfront hotels in a destination by their current beach conditions (best first).",
    parameters: {
      type: "object",
      properties: {
        destination: { type: "string", description: "Destination or city name." },
        limit: { type: "number", description: "Max hotels to return (default 5)." },
      },
      required: ["destination"],
    },
  },
] as const;
