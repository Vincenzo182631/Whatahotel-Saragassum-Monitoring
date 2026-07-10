import { prisma } from "@/lib/prisma";
import { riskLevelFromScore, riskMeta } from "@/lib/risk";
import beachZones from "@/data/beach-zones.json";
import hotels from "@/data/hotels.json";

/**
 * Idempotent database seed — upserts the curated beach zones and hotels
 * (and each hotel's initial beach condition). Shared by the CLI seed script
 * and the protected bootstrap endpoint. Safe to run repeatedly.
 */
export async function seedDatabase(): Promise<{ zones: number; hotels: number }> {
  const zoneIdByName = new Map<string, string>();

  for (const z of beachZones) {
    const level = riskLevelFromScore(z.riskScore);
    const description = riskMeta(level).description;
    const zone = await prisma.beachZone.upsert({
      where: { name: z.destination },
      create: {
        name: z.destination,
        country: z.country,
        region: z.region ?? null,
        latitude: z.latitude,
        longitude: z.longitude,
        riskScore: z.riskScore,
        riskLevel: level,
        statusDescription: description,
        source: z.source ?? "USF/NOAA",
        notes: z.notes ?? null,
        offshoreBearing: (z as { offshoreBearing?: number }).offshoreBearing ?? null,
      },
      update: {
        country: z.country,
        region: z.region ?? null,
        latitude: z.latitude,
        longitude: z.longitude,
        riskScore: z.riskScore,
        riskLevel: level,
        statusDescription: description,
        source: z.source ?? "USF/NOAA",
        notes: z.notes ?? null,
        offshoreBearing: (z as { offshoreBearing?: number }).offshoreBearing ?? null,
      },
    });
    zoneIdByName.set(z.destination, zone.id);
  }

  let hotelCount = 0;
  for (const h of hotels) {
    const beachZoneId = zoneIdByName.get(h.beachZone);
    if (!beachZoneId) continue;

    const zone = beachZones.find((z) => z.destination === h.beachZone)!;
    const level = riskLevelFromScore(zone.riskScore);

    const hotel = await prisma.hotel.upsert({
      where: { slug: h.slug },
      create: {
        name: h.name,
        slug: h.slug,
        city: h.city,
        country: h.country,
        description: h.description ?? null,
        pricePerNight: h.pricePerNight ?? null,
        rating: h.rating ?? null,
        imageUrl: h.imageUrl ?? null,
        beachZoneId,
      },
      update: {
        name: h.name,
        city: h.city,
        country: h.country,
        description: h.description ?? null,
        pricePerNight: h.pricePerNight ?? null,
        rating: h.rating ?? null,
        imageUrl: h.imageUrl ?? null,
        beachZoneId,
      },
    });

    await prisma.hotelBeachCondition.upsert({
      where: { hotelId: hotel.id },
      create: {
        hotelId: hotel.id,
        beachZoneId,
        riskScore: zone.riskScore,
        riskLevel: level,
      },
      update: {
        beachZoneId,
        riskScore: zone.riskScore,
        riskLevel: level,
        lastUpdated: new Date(),
      },
    });
    hotelCount += 1;
  }

  return { zones: zoneIdByName.size, hotels: hotelCount };
}
