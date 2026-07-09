import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BeachIntelligence } from "@/components/BeachIntelligence";

export const dynamic = "force-dynamic";

export default async function HotelPage({
  params,
}: {
  params: { slug: string };
}) {
  const hotel = await prisma.hotel
    .findUnique({
      where: { slug: params.slug },
      include: { beachZone: true, condition: true },
    })
    .catch(() => null);

  if (!hotel) notFound();

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Link href="/search" className="text-sm text-sky-600 hover:underline">
          ← Back to search
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{hotel.name}</h1>
        <p className="mt-1 text-gray-500">
          {hotel.city}, {hotel.country}
        </p>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-700">
          {hotel.rating != null && <span>⭐ {hotel.rating.toFixed(1)}</span>}
          {hotel.pricePerNight != null && (
            <span>${hotel.pricePerNight} / night</span>
          )}
          <span>Beach zone: {hotel.beachZone.name}</span>
        </div>

        {hotel.description && (
          <p className="mt-6 text-gray-700">{hotel.description}</p>
        )}
      </div>

      <aside className="lg:col-span-1">
        {hotel.condition ? (
          <BeachIntelligence
            score={hotel.condition.riskScore}
            level={hotel.condition.riskLevel}
            description={hotel.beachZone.statusDescription}
            lastUpdated={hotel.condition.lastUpdated}
            zoneName={hotel.beachZone.name}
            source={hotel.beachZone.source}
          />
        ) : (
          <div className="rounded-2xl border border-dashed p-5 text-sm text-gray-500">
            Beach Intelligence data is not yet available for this hotel.
          </div>
        )}
      </aside>
    </div>
  );
}
