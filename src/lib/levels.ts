// Four-level sargassum presentation scale (Clear / Light / Moderate / Heavy),
// mapped from the canonical 0-100 beach score (higher = clearer water).
//
// The score stays the source of truth; this is a display layer that mirrors the
// common traveler-facing 4-tier scale. The 3-level RiskLevel enum used in the
// DB/API is unchanged — this sits alongside it for the map and UI.

export type BeachTier = "CLEAR" | "LIGHT" | "MODERATE" | "HEAVY";

export interface TierMeta {
  tier: BeachTier;
  label: string;
  emoji: string;
  /** Hex color for map markers / legends. */
  hex: string;
  /** Tailwind classes for pills. */
  className: string;
  description: string;
}

export const TIER_THRESHOLDS = { CLEAR: 85, LIGHT: 65, MODERATE: 45 } as const;

const META: Record<BeachTier, TierMeta> = {
  CLEAR: {
    tier: "CLEAR",
    label: "Clear",
    emoji: "🟢",
    hex: "#16a34a",
    className: "bg-green-100 text-green-800 border-green-200",
    description: "Clean water right now — safe to swim.",
  },
  LIGHT: {
    tier: "LIGHT",
    label: "Light",
    emoji: "🟡",
    hex: "#eab308",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
    description: "Minimal sargassum — manageable conditions.",
  },
  MODERATE: {
    tier: "MODERATE",
    label: "Moderate",
    emoji: "🟠",
    hex: "#f97316",
    className: "bg-orange-100 text-orange-800 border-orange-200",
    description: "Noticeable sargassum — check before heading out.",
  },
  HEAVY: {
    tier: "HEAVY",
    label: "Heavy",
    emoji: "🔴",
    hex: "#dc2626",
    className: "bg-red-100 text-red-800 border-red-200",
    description: "Significant sargassum — consider alternatives.",
  },
};

/** Map a 0-100 beach score to its 4-tier level. */
export function tierFromScore(score: number): BeachTier {
  const s = Number.isNaN(score) ? 0 : Math.max(0, Math.min(100, score));
  if (s >= TIER_THRESHOLDS.CLEAR) return "CLEAR";
  if (s >= TIER_THRESHOLDS.LIGHT) return "LIGHT";
  if (s >= TIER_THRESHOLDS.MODERATE) return "MODERATE";
  return "HEAVY";
}

export function tierMeta(tier: BeachTier): TierMeta {
  return META[tier];
}

export function tierMetaFromScore(score: number): TierMeta {
  return META[tierFromScore(score)];
}

/** The full legend, worst-to-best or best-to-worst as needed. */
export const TIER_LEGEND: TierMeta[] = [META.CLEAR, META.LIGHT, META.MODERATE, META.HEAVY];
