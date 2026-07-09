// Central risk-scoring logic for Beach Intelligence.
//
// Score is 0-100 where a HIGHER score means a SAFER beach (less sargassum).
//   90-100 -> LOW RISK    (🟢)
//   60-89  -> MODERATE RISK (🟡)
//   0-59   -> HIGH RISK    (🔴)

export type RiskLevel = "LOW" | "MODERATE" | "HIGH";

export interface RiskMeta {
  level: RiskLevel;
  label: string;
  emoji: string;
  /** Tailwind text color class. */
  color: string;
  /** Hex color, for non-Tailwind contexts (charts, emails). */
  hex: string;
  /** Traveler-facing default description. */
  description: string;
}

export const RISK_THRESHOLDS = {
  LOW: 90,
  MODERATE: 60,
} as const;

/** Derive the risk level from a 0-100 score. */
export function riskLevelFromScore(score: number): RiskLevel {
  const s = clampScore(score);
  if (s >= RISK_THRESHOLDS.LOW) return "LOW";
  if (s >= RISK_THRESHOLDS.MODERATE) return "MODERATE";
  return "HIGH";
}

/** Constrain a score to the valid 0-100 range and round to an integer. */
export function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

const META: Record<RiskLevel, RiskMeta> = {
  LOW: {
    level: "LOW",
    label: "Low Risk",
    emoji: "🟢",
    color: "text-risk-low",
    hex: "#16a34a",
    description: "Beach conditions currently appear favorable.",
  },
  MODERATE: {
    level: "MODERATE",
    label: "Moderate Risk",
    emoji: "🟡",
    color: "text-risk-moderate",
    hex: "#ca8a04",
    description: "Possible seasonal sargassum presence.",
  },
  HIGH: {
    level: "HIGH",
    label: "High Risk",
    emoji: "🔴",
    color: "text-risk-high",
    hex: "#dc2626",
    description: "Potential sargassum impact detected. Consider nearby alternatives.",
  },
};

/** Presentation metadata for a risk level. */
export function riskMeta(level: RiskLevel): RiskMeta {
  return META[level];
}

/** Convenience: metadata straight from a score. */
export function riskMetaFromScore(score: number): RiskMeta {
  return META[riskLevelFromScore(score)];
}

/** Human-friendly "Updated 2 hours ago" style string. */
export function relativeTime(date: Date | string, now: Date = new Date()): string {
  const then = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;

  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}
