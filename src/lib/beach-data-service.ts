import { prisma } from "@/lib/prisma";
import { clampScore, riskLevelFromScore, riskMeta } from "@/lib/risk";
import type { BeachImportRecord } from "@/types/beach";
import beachZoneSeed from "@/data/beach-zones.json";

/**
 * BeachDataService — the single ingestion point for beach condition data.
 *
 * For the MVP this reads manually-curated JSON records (Feature 7). It is
 * intentionally structured so that future providers (NOAA / USF fetchers,
 * tourism feeds, user reports) can be dropped in behind the same
 * `importRecords` contract without touching callers.
 */
export class BeachDataService {
  /**
   * Upsert a batch of beach zone records and recompute the beach condition
   * cache for every hotel attached to the affected zones.
   *
   * Risk level is always derived from the score so the two can never drift.
   */
  static async importRecords(records: BeachImportRecord[]): Promise<{
    imported: number;
    hotelsUpdated: number;
  }> {
    let hotelsUpdated = 0;

    for (const record of records) {
      const score = clampScore(record.riskScore);
      const level = riskLevelFromScore(score);
      const description =
        record.statusDescription?.trim() || riskMeta(level).description;

      const zone = await prisma.beachZone.upsert({
        where: { name: record.destination },
        create: {
          name: record.destination,
          country: coalesceZoneMeta(record.destination, "country"),
          region: coalesceZoneMeta(record.destination, "region"),
          latitude: coalesceZoneMeta(record.destination, "latitude"),
          longitude: coalesceZoneMeta(record.destination, "longitude"),
          riskScore: score,
          riskLevel: level,
          statusDescription: description,
          source: record.source ?? "Manual import",
          notes: record.notes ?? null,
          lastUpdated: new Date(),
        },
        update: {
          riskScore: score,
          riskLevel: level,
          statusDescription: description,
          source: record.source ?? undefined,
          notes: record.notes ?? undefined,
          lastUpdated: new Date(),
        },
      });

      hotelsUpdated += await this.syncHotelConditions(zone.id, score, level);
    }

    return { imported: records.length, hotelsUpdated };
  }

  /**
   * Recompute the denormalised HotelBeachCondition rows for a single zone.
   * Returns the number of hotels updated.
   */
  static async syncHotelConditions(
    beachZoneId: string,
    riskScore: number,
    riskLevel: ReturnType<typeof riskLevelFromScore>,
  ): Promise<number> {
    const hotels = await prisma.hotel.findMany({
      where: { beachZoneId },
      select: { id: true },
    });

    for (const hotel of hotels) {
      await prisma.hotelBeachCondition.upsert({
        where: { hotelId: hotel.id },
        create: {
          hotelId: hotel.id,
          beachZoneId,
          riskScore,
          riskLevel,
          lastUpdated: new Date(),
        },
        update: {
          beachZoneId,
          riskScore,
          riskLevel,
          lastUpdated: new Date(),
        },
      });
    }

    return hotels.length;
  }

  /**
   * Manually override a single zone's score (admin action). Keeps the hotel
   * cache in sync and stamps the source/notes so overrides are auditable.
   */
  static async setZoneScore(
    beachZoneId: string,
    riskScore: number,
    opts: { statusDescription?: string; source?: string; notes?: string } = {},
  ) {
    const score = clampScore(riskScore);
    const level = riskLevelFromScore(score);

    const zone = await prisma.beachZone.update({
      where: { id: beachZoneId },
      data: {
        riskScore: score,
        riskLevel: level,
        statusDescription:
          opts.statusDescription?.trim() || riskMeta(level).description,
        source: opts.source ?? "Manual override",
        notes: opts.notes,
        lastUpdated: new Date(),
      },
    });

    await this.syncHotelConditions(zone.id, score, level);
    return zone;
  }
}

/**
 * Look up static geo/country metadata for a destination from the bundled
 * seed. Used only when creating a brand-new zone from an import record that
 * carries just destination + score.
 */
function coalesceZoneMeta<K extends "country" | "region" | "latitude" | "longitude">(
  destination: string,
  key: K,
): K extends "latitude" | "longitude" ? number : string {
  const match = (beachZoneSeed as Array<Record<string, unknown>>).find(
    (z) => z.destination === destination,
  );
  const fallback = key === "latitude" || key === "longitude" ? 0 : "Unknown";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (match?.[key] ?? fallback) as any;
}
