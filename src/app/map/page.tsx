import { prisma } from "@/lib/prisma";
import { TIER_LEGEND } from "@/lib/levels";
import { MapPanel } from "./MapPanel";
import type { MapZone } from "@/components/BeachMap";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const zones = await prisma.beachZone
    .findMany({
      select: {
        id: true,
        name: true,
        country: true,
        region: true,
        latitude: true,
        longitude: true,
        riskScore: true,
        lastUpdated: true,
        forecastTrend: true,
        forecast: true,
      },
      orderBy: { name: "asc" },
    })
    .catch(() => []);

  const mapZones: MapZone[] = zones.map((z) => ({
    id: z.id,
    name: z.name,
    country: z.country,
    region: z.region,
    latitude: z.latitude,
    longitude: z.longitude,
    riskScore: z.riskScore,
    lastUpdated: z.lastUpdated.toISOString(),
    forecastTrend: z.forecastTrend,
    forecast: (z.forecast as MapZone["forecast"]) ?? null,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sargassum map</h1>
          <p className="mt-1 text-sm text-gray-500">
            Live beach conditions across {mapZones.length} monitored zones —
            colored by current sargassum level.
          </p>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-3">
          {TIER_LEGEND.map((t) => (
            <span key={t.tier} className="flex items-center gap-1.5 text-sm">
              <span
                className="inline-block h-3 w-3 rounded-full border border-white ring-1 ring-gray-300"
                style={{ backgroundColor: t.hex }}
              />
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {mapZones.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-gray-500">
          No zones to map yet.
        </p>
      ) : (
        <MapPanel zones={mapZones} />
      )}
    </div>
  );
}
