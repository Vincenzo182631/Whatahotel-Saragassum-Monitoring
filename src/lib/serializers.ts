import type { BeachZone, HotelBeachCondition, Hotel } from "@prisma/client";
import type { BeachZoneDTO, HotelBeachConditionDTO } from "@/types/beach";
import { tierFromScore, tierMeta } from "@/lib/levels";

export function serializeBeachZone(
  zone: BeachZone & { _count?: { hotels: number } },
): BeachZoneDTO {
  return {
    id: zone.id,
    name: zone.name,
    country: zone.country,
    region: zone.region,
    latitude: zone.latitude,
    longitude: zone.longitude,
    riskScore: zone.riskScore,
    riskLevel: zone.riskLevel,
    statusDescription: zone.statusDescription,
    source: zone.source,
    notes: zone.notes,
    lastUpdated: zone.lastUpdated.toISOString(),
    hotelsConnected: zone._count?.hotels,
    newsFlag: zone.newsFlag,
    newsSummary: zone.newsSummary,
    tier: tierFromScore(zone.riskScore),
    tierLabel: tierMeta(tierFromScore(zone.riskScore)).label,
    forecastTrend: zone.forecastTrend,
    forecast: (zone.forecast as BeachZoneDTO["forecast"]) ?? null,
  };
}

export function serializeHotelCondition(
  condition: HotelBeachCondition & {
    hotel: Pick<Hotel, "id" | "name">;
    beachZone: Pick<BeachZone, "id" | "name" | "statusDescription">;
  },
): HotelBeachConditionDTO {
  return {
    hotelId: condition.hotel.id,
    hotelName: condition.hotel.name,
    beachZoneId: condition.beachZone.id,
    beachZoneName: condition.beachZone.name,
    riskScore: condition.riskScore,
    riskLevel: condition.riskLevel,
    statusDescription: condition.beachZone.statusDescription,
    lastUpdated: condition.lastUpdated.toISOString(),
  };
}
