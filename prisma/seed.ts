import { PrismaClient } from "@prisma/client";
import beachZones from "../src/data/beach-zones.json";
import hotels from "../src/data/hotels.json";

const prisma = new PrismaClient();

type RiskLevel = "LOW" | "MODERATE" | "HIGH";

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 90) return "LOW";
  if (score >= 60) return "MODERATE";
  return "HIGH";
}

const DEFAULT_DESCRIPTION: Record<RiskLevel, string> = {
  LOW: "Beach conditions currently appear favorable.",
  MODERATE: "Possible seasonal sargassum presence.",
  HIGH: "Potential sargassum impact detected. Consider nearby alternatives.",
};

async function main() {
  console.log("Seeding beach zones...");
  const zoneIdByName = new Map<string, string>();

  for (const z of beachZones) {
    const level = riskLevelFromScore(z.riskScore);
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
        statusDescription: DEFAULT_DESCRIPTION[level],
        source: z.source ?? "USF/NOAA",
        notes: z.notes ?? null,
      },
      update: {
        country: z.country,
        region: z.region ?? null,
        latitude: z.latitude,
        longitude: z.longitude,
        riskScore: z.riskScore,
        riskLevel: level,
        statusDescription: DEFAULT_DESCRIPTION[level],
        source: z.source ?? "USF/NOAA",
        notes: z.notes ?? null,
      },
    });
    zoneIdByName.set(z.destination, zone.id);
  }
  console.log(`  ${zoneIdByName.size} beach zones ready.`);

  console.log("Seeding hotels...");
  let hotelCount = 0;
  for (const h of hotels) {
    const beachZoneId = zoneIdByName.get(h.beachZone);
    if (!beachZoneId) {
      console.warn(`  Skipping "${h.name}" — unknown beach zone "${h.beachZone}".`);
      continue;
    }

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
  console.log(`  ${hotelCount} hotels ready.`);
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
