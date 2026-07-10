import type { RiskLevel } from "@/lib/risk";

export type { RiskLevel };

/** Serialised beach zone as returned by the API (dates as ISO strings). */
export interface BeachZoneDTO {
  id: string;
  name: string;
  country: string;
  region: string | null;
  latitude: number;
  longitude: number;
  riskScore: number;
  riskLevel: RiskLevel;
  statusDescription: string;
  source: string;
  notes: string | null;
  lastUpdated: string;
  hotelsConnected?: number;
  /** Early-warning flag from recent news (does not change riskScore). */
  newsFlag?: boolean;
  newsSummary?: string | null;
  /** 4-tier presentation level derived from the score. */
  tier?: import("@/lib/levels").BeachTier;
  tierLabel?: string;
}

/** A recent news item / announcement about a beach zone. */
export interface BeachReportDTO {
  headline: string;
  url: string;
  source: string;
  publishedAt: string;
  severity: RiskLevel | null;
  summary: string | null;
}

/** Beach condition attached to a specific hotel. */
export interface HotelBeachConditionDTO {
  hotelId: string;
  hotelName: string;
  beachZoneId: string;
  beachZoneName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  statusDescription: string;
  lastUpdated: string;
}

/** Shape of a manual JSON import record (Feature 7 / BeachDataService). */
export interface BeachImportRecord {
  destination: string;
  riskScore: number;
  /** Optional; recomputed from riskScore if omitted or inconsistent. */
  riskLevel?: RiskLevel;
  statusDescription?: string;
  source?: string;
  notes?: string;
}

export interface ApiError {
  error: string;
}
