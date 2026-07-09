import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeHotelCondition } from "@/lib/serializers";

/**
 * GET /api/hotels/[id]/beach-condition
 * Returns the beach condition for a specific hotel.
 * Accepts either the hotel id or its slug.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const hotel = await prisma.hotel.findFirst({
      where: { OR: [{ id: params.id }, { slug: params.id }] },
      select: { id: true },
    });

    if (!hotel) {
      return NextResponse.json({ error: "Hotel not found." }, { status: 404 });
    }

    const condition = await prisma.hotelBeachCondition.findUnique({
      where: { hotelId: hotel.id },
      include: {
        hotel: { select: { id: true, name: true } },
        beachZone: {
          select: { id: true, name: true, statusDescription: true },
        },
      },
    });

    if (!condition) {
      return NextResponse.json(
        { error: "No beach condition recorded for this hotel yet." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      condition: serializeHotelCondition(condition),
    });
  } catch (error) {
    console.error(
      `GET /api/hotels/${params.id}/beach-condition failed:`,
      error,
    );
    return NextResponse.json(
      { error: "Failed to load hotel beach condition." },
      { status: 500 },
    );
  }
}
