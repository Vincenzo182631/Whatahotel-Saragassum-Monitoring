import { riskMeta, relativeTime, type RiskLevel } from "@/lib/risk";

export interface BeachIntelligenceProps {
  score: number;
  level: RiskLevel;
  description?: string;
  lastUpdated: string | Date;
  zoneName?: string;
  source?: string;
}

const RING: Record<RiskLevel, string> = {
  LOW: "border-green-300 bg-green-50",
  MODERATE: "border-yellow-300 bg-yellow-50",
  HIGH: "border-red-300 bg-red-50",
};

const BAR: Record<RiskLevel, string> = {
  LOW: "bg-risk-low",
  MODERATE: "bg-risk-moderate",
  HIGH: "bg-risk-high",
};

/**
 * WhataHotel Beach Intelligence™ card — the primary traveler-facing widget
 * (Feature 3). Drop onto any hotel page.
 */
export function BeachIntelligence({
  score,
  level,
  description,
  lastUpdated,
  zoneName,
  source,
}: BeachIntelligenceProps) {
  const meta = riskMeta(level);
  const copy = description ?? meta.description;

  return (
    <section
      className={`rounded-2xl border p-5 shadow-sm ${RING[level]}`}
      aria-label="Beach Intelligence"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-wide text-gray-600">
            Beach Intelligence
          </span>
          <span className="text-xs text-gray-400">™</span>
        </div>
        <span className="text-2xl" aria-hidden>
          {meta.emoji}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl font-bold text-gray-900">{score}</span>
        <span className="text-lg text-gray-500">/100</span>
        <span className={`ml-2 text-sm font-semibold ${meta.color}`}>
          {meta.label.toUpperCase()}
        </span>
      </div>

      {/* Score meter */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full ${BAR[level]}`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>

      <p className="mt-3 text-sm text-gray-700">{copy}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        {zoneName && <span>Zone: {zoneName}</span>}
        <span>Updated {relativeTime(lastUpdated)}</span>
        {source && <span>Source: {source}</span>}
      </div>
    </section>
  );
}
