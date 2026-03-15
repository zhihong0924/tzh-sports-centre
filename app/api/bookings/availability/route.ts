import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBlockedSlots } from "@/lib/court-conflict";
import { validateFutureDate } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date");
    const courtIdParam = searchParams.get("courtId");

    if (!date) {
      return NextResponse.json(
        { error: "Date is required" },
        { status: 400 },
      );
    }

    const validatedDate = validateFutureDate(date, true);
    if (!validatedDate) {
      return NextResponse.json(
        { error: "Invalid or past date" },
        { status: 400 },
      );
    }

    const queryDate = new Date(date);
    queryDate.setHours(0, 0, 0, 0);

    // If courtId specified, get slots for that court only
    if (courtIdParam) {
      const courtId = parseInt(courtIdParam, 10);
      if (isNaN(courtId)) {
        return NextResponse.json(
          { error: "Invalid court ID" },
          { status: 400 },
        );
      }

      const slots = await getBlockedSlots(courtId, queryDate);
      return NextResponse.json({ slots });
    }

    // Otherwise get slots for all active courts
    const courts = await prisma.court.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    const allSlots: Record<number, Awaited<ReturnType<typeof getBlockedSlots>>> = {};

    await Promise.all(
      courts.map(async (court) => {
        allSlots[court.id] = await getBlockedSlots(court.id, queryDate);
      }),
    );

    return NextResponse.json({ courts, slots: allSlots });
  } catch (error) {
    console.error("Error fetching availability:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 },
    );
  }
}
