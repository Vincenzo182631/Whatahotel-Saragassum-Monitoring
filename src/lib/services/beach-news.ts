import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasLLM, classifierModel } from "@/lib/llm";
import type { RiskLevel } from "@/lib/risk";

/**
 * Beach News service — the "always check news & announcements" layer.
 *
 * For each beach zone it searches recent news (Google News RSS, free, no key),
 * has an LLM classify each item's relevance + sargassum severity, stores them
 * as BeachReports, and raises an EARLY-WARNING FLAG when recent news indicates
 * conditions worse than the satellite reading. It never changes the satellite
 * riskScore — that stays auditable; news is context + a flag only.
 *
 * Requires an LLM key (ANTHROPIC_API_KEY or OPENAI_API_KEY). Without one it
 * safely no-ops.
 */

const RECENCY_DAYS = 45; // consider items from the last 45 days (news is sparse)
const FLAG_DAYS = 21; // only recent items drive the early-warning flag
const KEEP_DAYS = 60; // prune reports older than this
const MAX_ITEMS_PER_ZONE = 8;
const FETCH_TIMEOUT_MS = 12000;

const SEV_RANK: Record<RiskLevel, number> = { LOW: 0, MODERATE: 1, HIGH: 2 };

interface RawItem {
  headline: string;
  url: string;
  source: string;
  publishedAt: Date;
}

export interface BeachNewsResult {
  ranAt: string;
  status: "updated" | "skipped";
  zonesChecked: number;
  itemsStored: number;
  flagged: number;
  message?: string;
}

/** Refresh news for every zone. Safe no-op when no LLM key is configured. */
export async function refreshBeachNews(now: Date = new Date()): Promise<BeachNewsResult> {
  const ranAt = now.toISOString();
  if (!hasLLM()) {
    return {
      ranAt,
      status: "skipped",
      zonesChecked: 0,
      itemsStored: 0,
      flagged: 0,
      message: "No LLM key (ANTHROPIC_API_KEY / OPENAI_API_KEY) — news check disabled.",
    };
  }

  const zones = await prisma.beachZone.findMany({
    select: { id: true, name: true, country: true, region: true, riskLevel: true },
  });

  let itemsStored = 0;
  let flagged = 0;

  const outcomes = await Promise.all(
    zones.map(async (zone) => {
      try {
        return await refreshZone(zone, now);
      } catch (error) {
        console.error(`[news] "${zone.name}" failed:`, error);
        return { stored: 0, flagged: false };
      }
    }),
  );
  for (const o of outcomes) {
    itemsStored += o.stored;
    if (o.flagged) flagged += 1;
  }

  return {
    ranAt,
    status: "updated",
    zonesChecked: zones.length,
    itemsStored,
    flagged,
  };
}

async function refreshZone(
  zone: { id: string; name: string; country: string; region: string | null; riskLevel: RiskLevel },
  now: Date,
): Promise<{ stored: number; flagged: boolean }> {
  const raw = await fetchGoogleNews(searchTerm(zone.name, zone.country), now);

  // Classify and upsert whatever the fetch returned (possibly nothing).
  let stored = 0;
  if (raw.length > 0) {
    const classified = await classify(zone.name, raw);
    for (let i = 0; i < raw.length; i++) {
      const c = classified[i];
      if (!c) continue;
      const severity = c.severity === "NONE" ? null : (c.severity as RiskLevel);
      await prisma.beachReport.upsert({
        where: { beachZoneId_url: { beachZoneId: zone.id, url: raw[i].url } },
        create: {
          beachZoneId: zone.id,
          headline: raw[i].headline,
          url: raw[i].url,
          source: raw[i].source,
          publishedAt: raw[i].publishedAt,
          severity,
          relevant: c.relevant,
          summary: c.summary || null,
        },
        update: { severity, relevant: c.relevant, summary: c.summary || null },
      });
      stored += 1;
    }
  }

  // Early-warning flag: recomputed from the STORED reports, not this run's
  // fetch. That makes the flag's lifecycle robust in both directions:
  //  - an LLM/fetch hiccup (nothing classified this run) can't erase a flag
  //    whose stored evidence is still within the window, and
  //  - a flag naturally EXPIRES once its newest qualifying report is older
  //    than FLAG_DAYS, even if Google stops returning any items for the zone.
  const flagCutoff = new Date(now.getTime() - FLAG_DAYS * 86400000);
  const recent = await prisma.beachReport.findMany({
    where: {
      beachZoneId: zone.id,
      relevant: true,
      severity: { not: null },
      publishedAt: { gte: flagCutoff },
    },
    orderBy: { publishedAt: "desc" },
  });

  let worst: RiskLevel | null = null;
  let worstSummary: string | null = null;
  let worstSource = "";
  for (const r of recent) {
    const sev = r.severity as RiskLevel;
    if (worst === null || SEV_RANK[sev] > SEV_RANK[worst]) {
      worst = sev;
      worstSummary = r.summary || r.headline;
      worstSource = r.source;
    }
  }

  const flagged = worst !== null && SEV_RANK[worst] > SEV_RANK[zone.riskLevel];
  await prisma.beachZone.update({
    where: { id: zone.id },
    data: {
      newsFlag: flagged,
      newsSummary: flagged
        ? `${worstSummary}${worstSource ? ` (${worstSource})` : ""}`
        : null,
      newsCheckedAt: now,
    },
  });

  // Prune old items.
  await prisma.beachReport.deleteMany({
    where: { beachZoneId: zone.id, publishedAt: { lt: new Date(now.getTime() - KEEP_DAYS * 86400000) } },
  });

  return { stored, flagged };
}

/** Build a news query. Broad on purpose — the LLM filters relevance. */
function searchTerm(zoneName: string, country: string): string {
  const place = zoneName.replace(/\s+Hotel\s+Zone$/i, "").trim();
  // Spanish-language local outlets ("sargazo") are often the most timely for
  // the Mexican Caribbean / DR; include the term there.
  const term = /mexico|dominican|republic/i.test(country) ? "sargassum sargazo" : "sargassum";
  return `${place} ${term}`;
}

async function fetchGoogleNews(query: string, now: Date): Promise<RawItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let xml: string;
  try {
    const res = await globalThis.fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "WhataHotelBeachIntelligence/1.0", Accept: "application/rss+xml" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    xml = await res.text();
  } finally {
    clearTimeout(timer);
  }

  const cutoff = new Date(now.getTime() - RECENCY_DAYS * 86400000);
  const items: RawItem[] = [];
  for (const block of xml.split(/<item>/).slice(1)) {
    const title = decodeXml(pick(block, "title"));
    const link = pick(block, "link").trim();
    const pub = pick(block, "pubDate").trim();
    const source = decodeXml(pick(block, "source")) || "news";
    if (!title || !link || !pub) continue;
    const publishedAt = new Date(pub);
    if (Number.isNaN(publishedAt.getTime()) || publishedAt < cutoff) continue;
    items.push({ headline: title, url: link, source, publishedAt });
  }
  items.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  return items.slice(0, MAX_ITEMS_PER_ZONE);
}

const classificationSchema = z.object({
  items: z.array(
    z.object({
      index: z.number(),
      relevant: z.boolean(),
      severity: z.enum(["LOW", "MODERATE", "HIGH", "NONE"]),
      summary: z.string(),
    }),
  ),
});

type Classification = { relevant: boolean; severity: string; summary: string };

async function classify(zoneName: string, items: RawItem[]): Promise<(Classification | null)[]> {
  const { generateObject } = await import("ai");
  const model = await classifierModel();

  const list = items
    .map((it, i) => `${i}. (${it.source}, ${it.publishedAt.toISOString().slice(0, 10)}) ${it.headline}`)
    .join("\n");

  try {
    const { object } = await generateObject({
      model,
      schema: classificationSchema,
      system:
        "You classify news headlines about SARGASSUM (seaweed) beach conditions for a travel service. " +
        "For each item decide: relevant (is it about CURRENT sargassum/seaweed conditions at this destination — not old news, not unrelated), " +
        "severity of the situation it describes (HIGH = mass arrival, beaches covered/closed, record amounts; MODERATE = noticeable/patchy presence; LOW = little/none or cleared/improving; NONE = not about current conditions), " +
        "and a one-line factual summary. Return one entry per input index.",
      prompt: `Destination: ${zoneName}\n\nHeadlines:\n${list}`,
    });
    const byIndex = new Map<number, Classification>();
    for (const it of object.items) {
      byIndex.set(it.index, { relevant: it.relevant, severity: it.severity, summary: it.summary });
    }
    return items.map((_, i) => byIndex.get(i) ?? null);
  } catch (error) {
    console.error(`[news] classify failed for "${zoneName}":`, error);
    return items.map(() => null);
  }
}

function pick(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}
