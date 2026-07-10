import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { RiskBadge } from "@/components/RiskBadge";
import type { RiskLevel } from "@/lib/risk";

export const dynamic = "force-dynamic";

const RISK_LEVELS: RiskLevel[] = ["LOW", "MODERATE", "HIGH"];

interface SearchParams {
  q?: string;
  country?: string;
  goodOnly?: string;
  hideHigh?: string;
  sort?: string;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, country, goodOnly, hideHigh, sort = "beach" } = searchParams;

  // Beach-condition filters (Feature 4).
  const allowedLevels: RiskLevel[] = goodOnly
    ? ["LOW", "MODERATE"]
    : hideHigh
      ? RISK_LEVELS.filter((l) => l !== "HIGH")
      : RISK_LEVELS;

  const where: Prisma.HotelWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(country ? { country: { equals: country, mode: "insensitive" } } : {}),
    condition: { is: { riskLevel: { in: allowedLevels } } },
  };

  const hotels = await prisma.hotel
    .findMany({
      where,
      include: { condition: true },
    })
    .catch(() => []);

  const sorted = [...hotels].sort((a, b) => {
    if (sort === "price") {
      return (a.pricePerNight ?? Infinity) - (b.pricePerNight ?? Infinity);
    }
    if (sort === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
    return (b.condition?.riskScore ?? -1) - (a.condition?.riskScore ?? -1);
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Search hotels</h1>
      <p className="mt-1 text-sm text-gray-500">
        Results ranked by Beach Intelligence — clearest beaches first.
      </p>

      {/* Filters */}
      <form className="mt-6 flex flex-wrap items-end gap-4 rounded-xl border bg-white p-4">
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-gray-600">Search</span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Hotel or city"
            className="rounded-md border px-3 py-1.5"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-gray-600">Country</span>
          <input
            type="text"
            name="country"
            defaultValue={country}
            placeholder="e.g. Mexico"
            className="rounded-md border px-3 py-1.5"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-gray-600">Sort by</span>
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-md border px-3 py-1.5"
          >
            <option value="beach">Beach conditions</option>
            <option value="rating">Rating</option>
            <option value="price">Price</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="goodOnly" value="1" defaultChecked={!!goodOnly} />
          Show only good beach conditions
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="hideHigh" value="1" defaultChecked={!!hideHigh} />
          Hide possible sargassum-affected hotels
        </label>
        <button
          type="submit"
          className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
        >
          Apply
        </button>
      </form>

      {/* Results table */}
      <div className="mt-6 overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Hotel</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Rating</th>
              <th className="px-4 py-3 font-medium">Beach</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No hotels match these filters.
                </td>
              </tr>
            ) : (
              sorted.map((h) => (
                <tr key={h.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/hotels/${h.slug}`}
                      className="font-medium text-sky-700 hover:underline"
                    >
                      {h.name}
                    </Link>
                    <div className="text-xs text-gray-400">{h.city}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {h.pricePerNight != null ? `$${h.pricePerNight}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {h.rating != null ? h.rating.toFixed(1) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {h.condition ? (
                      <RiskBadge
                        level={h.condition.riskLevel}
                        score={h.condition.riskScore}
                        size="sm"
                        showLabel={false}
                      />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
