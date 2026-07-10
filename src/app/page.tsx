import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { RiskBadge } from "@/components/RiskBadge";
import { relativeTime } from "@/lib/risk";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const zones = await prisma.beachZone
    .findMany({
      include: { _count: { select: { hotels: true } } },
      orderBy: { riskScore: "desc" },
    })
    .catch(() => []);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-br from-sky-600 to-cyan-500 p-8 text-white">
        <h1 className="text-3xl font-bold">Beach Intelligence™</h1>
        <p className="mt-2 max-w-2xl text-sky-50">
          Every beachfront hotel gets a live sargassum risk indicator so
          travelers know what to expect before they book. Scores are 0–100 —
          the higher the score, the clearer the beach.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-white/15 px-3 py-1">🟢 90–100 Low Risk</span>
          <span className="rounded-full bg-white/15 px-3 py-1">🟡 60–89 Moderate Risk</span>
          <span className="rounded-full bg-white/15 px-3 py-1">🔴 0–59 High Risk</span>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Monitored beach zones</h2>
          <Link href="/search" className="text-sm text-sky-600 hover:underline">
            Search hotels →
          </Link>
        </div>

        {zones.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-gray-500">
            No beach zones yet. Run <code>npm run db:seed</code> to load sample
            data.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {zones.map((z) => (
              <Link
                key={z.id}
                href={`/search?country=${encodeURIComponent(z.country)}`}
                className="rounded-xl border bg-white p-4 transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{z.name}</h3>
                    <p className="text-xs text-gray-500">
                      {z.region ? `${z.region}, ` : ""}
                      {z.country}
                    </p>
                  </div>
                  <RiskBadge level={z.riskLevel} score={z.riskScore} showLabel={false} />
                </div>
                <p className="mt-3 text-sm text-gray-600">{z.statusDescription}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                  <span>{z._count.hotels} hotels</span>
                  <span>Updated {relativeTime(z.lastUpdated)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
