import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getBeachCondition, rankHotelsByBeach } from "@/lib/chatbot-tools";

export const dynamic = "force-dynamic";

/**
 * GET /api/chatbot/beach-condition?destination=Cancun[&hotels=true]
 *
 * Thin HTTP wrapper over the chatbot Beach Intelligence tools (Feature 5)
 * so the AI layer can call them over the network if desired.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const destination = searchParams.get("destination")?.trim();
    const includeHotels = searchParams.get("hotels") === "true";

    if (!destination) {
      return NextResponse.json(
        { error: "Query param `destination` is required." },
        { status: 400 },
      );
    }

    const condition = await getBeachCondition(destination);
    if (!condition) {
      return NextResponse.json(
        { error: `No beach condition data found for "${destination}".` },
        { status: 404 },
      );
    }

    const hotels = includeHotels
      ? await rankHotelsByBeach(destination)
      : undefined;

    return NextResponse.json({ condition, ...(hotels ? { hotels } : {}) });
  } catch (error) {
    console.error("GET /api/chatbot/beach-condition failed:", error);
    return NextResponse.json(
      { error: "Failed to resolve beach condition." },
      { status: 500 },
    );
  }
}
