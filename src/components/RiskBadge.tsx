import { riskMeta, type RiskLevel } from "@/lib/risk";

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  size?: "sm" | "md";
  showLabel?: boolean;
}

const BG: Record<RiskLevel, string> = {
  LOW: "bg-green-100 text-green-800 border-green-200",
  MODERATE: "bg-yellow-100 text-yellow-800 border-yellow-200",
  HIGH: "bg-red-100 text-red-800 border-red-200",
};

/**
 * Compact colored pill used in search rows, hotel cards and the admin table.
 */
export function RiskBadge({
  level,
  score,
  size = "md",
  showLabel = true,
}: RiskBadgeProps) {
  const meta = riskMeta(level);
  const pad = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${BG[level]} ${pad}`}
      title={`${meta.label}${score != null ? ` — ${score}/100` : ""}`}
    >
      <span aria-hidden>{meta.emoji}</span>
      {score != null && <span className="font-semibold">{score}</span>}
      {showLabel && <span>{meta.label}</span>}
    </span>
  );
}
