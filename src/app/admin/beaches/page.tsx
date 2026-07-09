import { prisma } from "@/lib/prisma";
import { relativeTime } from "@/lib/risk";
import { AdminBeachRow } from "./AdminBeachRow";

export const dynamic = "force-dynamic";

export default async function AdminBeachesPage() {
  const zones = await prisma.beachZone
    .findMany({
      include: { _count: { select: { hotels: true } } },
      orderBy: { name: "asc" },
    })
    .catch(() => []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Beach Monitoring</h1>
      <p className="mt-1 text-sm text-gray-500">
        Internal dashboard — manually adjust risk scores and override incorrect
        data. Changes cascade to every connected hotel.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Destination</th>
              <th className="px-4 py-3 font-medium">Risk</th>
              <th className="px-4 py-3 font-medium">Hotels</th>
              <th className="px-4 py-3 font-medium">Last update</th>
              <th className="px-4 py-3 font-medium">Override score</th>
            </tr>
          </thead>
          <tbody>
            {zones.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No beach zones. Run <code>npm run db:seed</code>.
                </td>
              </tr>
            ) : (
              zones.map((z) => (
                <AdminBeachRow
                  key={z.id}
                  id={z.id}
                  name={z.name}
                  country={z.country}
                  riskScore={z.riskScore}
                  riskLevel={z.riskLevel}
                  hotelsConnected={z._count.hotels}
                  lastUpdatedLabel={relativeTime(z.lastUpdated)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
