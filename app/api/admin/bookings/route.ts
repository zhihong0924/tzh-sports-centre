import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";
import { getCachedTimeSlots, getCachedCourts } from "@/lib/cache";
import { calculateBookingAmount } from "@/lib/recurring-booking-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || !isAdmin(session.user.email, session.user.isAdmin)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const queryDate = new Date(date);
    const dayOfWeek = queryDate.getDay();

    const [bookings, recurringBookings, lessonSessions, trainingGroups, timeSlots, courts] =
      await Promise.all([
        prisma.booking.findMany({
          where: {
            bookingDate: queryDate,
            status: { in: ["pending", "confirmed"] },
          },
          include: {
            court: true,
            user: {
              select: {
                name: true,
                phone: true,
                email: true,
              },
            },
          },
          orderBy: [{ courtId: "asc" }, { startTime: "asc" }],
        }),
        prisma.recurringBooking.findMany({
          where: {
            dayOfWeek,
            isActive: true,
            startDate: { lte: queryDate },
            OR: [{ endDate: null }, { endDate: { gte: queryDate } }],
          },
          include: {
            court: true,
            user: {
              select: {
                name: true,
                phone: true,
                email: true,
              },
            },
          },
          orderBy: [{ courtId: "asc" }, { startTime: "asc" }],
        }),
        prisma.lessonSession.findMany({
          where: {
            lessonDate: queryDate,
            status: "scheduled",
          },
          include: {
            students: { select: { name: true } },
          },
          orderBy: [{ courtId: "asc" }, { startTime: "asc" }],
        }),
        prisma.trainingGroup.findMany({
          where: {
            dayOfWeek,
            isActive: true,
            courtId: { not: null },
          },
          include: {
            members: { select: { name: true } },
            teacher: { select: { name: true } },
          },
        }),
        getCachedTimeSlots(),
        getCachedCourts(),
      ]);

    const bookingMap: Record<
      string,
      {
        id: string;
        name: string;
        phone: string;
        email: string | null;
        sport: string;
        status: string;
        paymentStatus?: string;
        paymentUserConfirmed?: boolean;
        paymentMethod?: string;
        paymentScreenshotUrl?: string | null;
        receiptVerificationStatus?: string | null;
        verificationNotes?: string | null;
        totalAmount?: number;
        isGuest: boolean;
        isRecurring?: boolean;
        recurringLabel?: string;
        isLesson?: boolean;
        lessonStudents?: string[];
        lessonType?: string;
        lessonStatus?: string;
      }
    > = {};

    bookings.forEach((booking) => {
      const key = `${booking.courtId}-${booking.startTime}`;
      bookingMap[key] = {
        id: booking.id,
        name: booking.guestName || booking.user?.name || "Unknown",
        phone: booking.guestPhone || booking.user?.phone || "",
        email: booking.guestEmail || booking.user?.email || null,
        sport: booking.sport,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        paymentUserConfirmed: booking.paymentUserConfirmed,
        paymentMethod: booking.paymentMethod || undefined,
        paymentScreenshotUrl: booking.paymentScreenshotUrl,
        receiptVerificationStatus: booking.receiptVerificationStatus,
        verificationNotes: booking.verificationNotes,
        totalAmount: booking.totalAmount,
        isGuest: !booking.userId,
      };
    });

    recurringBookings.forEach((recurring) => {
      const key = `${recurring.courtId}-${recurring.startTime}`;
      if (!bookingMap[key]) {
        bookingMap[key] = {
          id: recurring.id,
          name:
            recurring.label ||
            recurring.guestName ||
            recurring.user?.name ||
            "Recurring",
          phone: recurring.guestPhone || recurring.user?.phone || "",
          email: recurring.user?.email || null,
          sport: recurring.sport,
          status: "recurring",
          isGuest: !recurring.userId,
          isRecurring: true,
          recurringLabel: recurring.label || undefined,
        };
      }
    });

    const allSlotTimes = timeSlots.map((s: { slotTime: string }) => s.slotTime);
    lessonSessions.forEach((lesson) => {
      const studentNames = lesson.students.map(
        (s: { name: string | null }) => s.name || "Unknown",
      );
      const startIdx = allSlotTimes.indexOf(lesson.startTime);
      const endIdx = allSlotTimes.indexOf(lesson.endTime);
      if (startIdx === -1) return;
      const endIndex = endIdx !== -1 ? endIdx : allSlotTimes.length;
      for (let i = startIdx; i < endIndex; i++) {
        const key = `${lesson.courtId}-${allSlotTimes[i]}`;
        if (!bookingMap[key]) {
          bookingMap[key] = {
            id: lesson.id,
            name: studentNames.join(", ") || "Lesson",
            phone: "",
            email: null,
            sport: lesson.lessonType,
            status: "lesson",
            isGuest: false,
            isLesson: true,
            lessonStudents: studentNames,
            lessonType: lesson.lessonType,
            lessonStatus: lesson.status,
          };
        }
      }
    });

    // Add training group slots to booking map
    const allSlotTimesForGroups = timeSlots.map((s: { slotTime: string }) => s.slotTime);
    trainingGroups.forEach((group) => {
      if (!group.courtId) return;
      const startIdx = allSlotTimesForGroups.indexOf(group.startTime);
      const endIdx = allSlotTimesForGroups.indexOf(group.endTime);
      if (startIdx === -1) return;
      const endIndex = endIdx !== -1 ? endIdx : allSlotTimesForGroups.length;
      const memberNames = group.members.map((m: { name: string | null }) => m.name || "Unknown");
      for (let i = startIdx; i < endIndex; i++) {
        const key = `${group.courtId}-${allSlotTimesForGroups[i]}`;
        if (!bookingMap[key]) {
          bookingMap[key] = {
            id: group.id,
            name: group.name + (group.teacher ? ` (${group.teacher.name})` : ""),
            phone: "",
            email: null,
            sport: group.sport,
            status: "training",
            isGuest: false,
            isLesson: true,
            lessonStudents: memberNames,
            lessonType: `Training: ${group.groupType}`,
          };
        }
      }
    });

    return NextResponse.json({
      date,
      bookings,
      recurringBookings,
      trainingGroups,
      bookingMap,
      timeSlots,
      courts,
    });
  } catch (error) {
    console.error("Error fetching admin bookings:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || !isAdmin(session.user.email, session.user.isAdmin)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const bookingIds: string[] =
      body.bookingIds || (body.bookingId ? [body.bookingId] : []);

    if (bookingIds.length === 0) {
      return NextResponse.json(
        { error: "Booking ID(s) required" },
        { status: 400 },
      );
    }

    await prisma.booking.updateMany({
      where: { id: { in: bookingIds } },
      data: { status: "cancelled" },
    });

    logAdminAction({
      adminId: session.user.id!,
      adminEmail: session.user.email!,
      action: "booking_cancel",
      targetType: "booking",
      details: { bookingIds, count: bookingIds.length },
    });

    return NextResponse.json({ success: true, cancelled: bookingIds.length });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return NextResponse.json(
      { error: "Failed to cancel booking" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || !isAdmin(session.user.email, session.user.isAdmin)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { courtId, date, startTime, endTime, sport, guestName, guestPhone } =
      await request.json();

    if (
      !courtId ||
      !date ||
      !startTime ||
      !endTime ||
      !sport ||
      !guestName ||
      !guestPhone
    ) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 },
      );
    }

    const bookingDate = new Date(date);
    const dayOfWeek = bookingDate.getDay();

    const [existing, recurringConflict, lessonConflict, court] =
      await Promise.all([
        prisma.booking.findFirst({
          where: {
            courtId,
            bookingDate,
            startTime,
            status: { in: ["pending", "confirmed"] },
          },
        }),
        prisma.recurringBooking.findFirst({
          where: {
            courtId,
            dayOfWeek,
            startTime,
            isActive: true,
            startDate: { lte: bookingDate },
            OR: [{ endDate: null }, { endDate: { gte: bookingDate } }],
          },
        }),
        prisma.lessonSession.findFirst({
          where: {
            courtId,
            lessonDate: bookingDate,
            status: "scheduled",
            startTime: { lte: startTime },
            endTime: { gt: startTime },
          },
        }),
        prisma.court.findUnique({ where: { id: courtId } }),
      ]);

    if (existing) {
      return NextResponse.json(
        { error: "This slot is already booked" },
        { status: 400 },
      );
    }

    if (recurringConflict) {
      return NextResponse.json(
        { error: "This slot conflicts with a recurring booking" },
        { status: 400 },
      );
    }

    if (lessonConflict) {
      return NextResponse.json(
        { error: "This slot conflicts with a scheduled lesson" },
        { status: 400 },
      );
    }
    if (!court) {
      return NextResponse.json({ error: "Court not found" }, { status: 404 });
    }

    const totalAmount = calculateBookingAmount(startTime, endTime, sport);

    try {
      const booking = await prisma.booking.create({
        data: {
          courtId,
          bookingDate: new Date(date),
          startTime,
          endTime,
          sport,
          totalAmount,
          status: "confirmed",
          paymentStatus: "paid",
          paymentExempt: true,
          guestName,
          guestPhone,
        },
      });

      return NextResponse.json({ success: true, booking });
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "This slot was just booked by someone else." },
          { status: 409 },
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || !isAdmin(session.user.email, session.user.isAdmin)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bookingId, action, notes } = await request.json();

    if (!bookingId || !action) {
      return NextResponse.json(
        { error: "Booking ID and action are required" },
        { status: 400 },
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 },
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { user: { select: { phone: true } } },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const phone = booking.guestPhone || booking.user?.phone;
    const siblingFilter = phone
      ? {
          bookingDate: booking.bookingDate,
          status: { not: "cancelled" },
          OR: [{ guestPhone: phone }, { user: { phone } }],
        }
      : { id: bookingId };

    if (action === "approve") {
      const result = await prisma.booking.updateMany({
        where: siblingFilter,
        data: {
          receiptVerificationStatus: "approved",
          verificationNotes: notes || null,
          verifiedAt: new Date(),
          verifiedBy: session.user.email,
          paymentStatus: "paid",
          paymentExempt: true,
          status: "confirmed",
          paidAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        status: "approved",
        count: result.count,
      });
    } else {
      const result = await prisma.booking.updateMany({
        where: siblingFilter,
        data: {
          receiptVerificationStatus: "rejected",
          verificationNotes: notes || null,
          verifiedAt: new Date(),
          verifiedBy: session.user.email,
          status: "cancelled",
          cancelledAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        status: "rejected",
        count: result.count,
      });
    }
  } catch (error) {
    console.error("Error verifying receipt:", error);
    return NextResponse.json(
      { error: "Failed to verify receipt" },
      { status: 500 },
    );
  }
}
