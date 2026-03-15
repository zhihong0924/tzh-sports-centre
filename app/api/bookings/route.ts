import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { calculateBookingAmount } from "@/lib/recurring-booking-utils";
import { calculatePaymentDeadline } from "@/lib/booking-expiration";
import {
  validateMalaysianPhone,
  validateEmail,
  validateSport,
  validateFutureDate,
  sanitiseText,
} from "@/lib/validation";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        court: true,
      },
      orderBy: [{ bookingDate: "desc" }, { startTime: "asc" }],
    });

    return NextResponse.json({ bookings });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const { success } = checkRateLimit(`booking:${ip}`, RATE_LIMITS.booking);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  try {
    const session = await auth();
    const body = await request.json();
    const {
      slots,
      date,
      sport,
      isTestBooking,
      isGuestBooking,
      guestName,
      guestPhone,
      guestEmail,
      payAtCounter,
      paymentMethod,
      paymentUserConfirmed,
      receiptUrl,
    } = body;

    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ error: "No slots selected" }, { status: 400 });
    }

    if (!date || !sport) {
      return NextResponse.json(
        { error: "Date and sport are required" },
        { status: 400 },
      );
    }

    const validatedSport = validateSport(sport);
    if (!validatedSport) {
      return NextResponse.json(
        { error: "Invalid sport type. Must be badminton or pickleball." },
        { status: 400 },
      );
    }

    const validatedDate = validateFutureDate(date);
    if (!validatedDate) {
      return NextResponse.json(
        { error: "Booking date cannot be in the past" },
        { status: 400 },
      );
    }

    let userId: string | null = null;
    let bookingGuestName: string | null = null;
    let bookingGuestPhone: string | null = null;
    let bookingGuestEmail: string | null = null;
    let bookingStatus = "pending";
    let paymentStatus = "pending";

    if (
      isGuestBooking ||
      paymentMethod === "tng" ||
      paymentMethod === "duitnow"
    ) {
      if (!guestName && !session?.user?.name) {
        return NextResponse.json(
          { error: "Name is required for bookings" },
          { status: 400 },
        );
      }

      const phone = guestPhone?.trim() || null;
      if (!phone && !session?.user?.id) {
        return NextResponse.json(
          { error: "Phone number is required for guest bookings" },
          { status: 400 },
        );
      }

      if (phone) {
        const validatedPhone = validateMalaysianPhone(phone);
        if (!validatedPhone) {
          return NextResponse.json(
            {
              error:
                "Invalid phone number format. Please use a valid Malaysian phone number.",
            },
            { status: 400 },
          );
        }
        bookingGuestPhone = validatedPhone;
      }

      if (guestEmail?.trim()) {
        const validatedEmail = validateEmail(guestEmail);
        if (!validatedEmail) {
          return NextResponse.json(
            { error: "Invalid email address format" },
            { status: 400 },
          );
        }
        bookingGuestEmail = validatedEmail;
      } else {
        bookingGuestEmail = session?.user?.email || null;
      }

      bookingGuestName = sanitiseText(guestName) || session?.user?.name || null;

      if (session?.user?.id) {
        userId = session.user.id;
      }

      if (
        payAtCounter ||
        paymentMethod === "tng" ||
        paymentMethod === "duitnow"
      ) {
        bookingStatus = "confirmed";
        paymentStatus = "pending";
      }
    } else if (isTestBooking) {
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (
        !session.user.email ||
        !isAdmin(session.user.email, session.user.isAdmin)
      ) {
        return NextResponse.json(
          { error: "Only admins can create test bookings" },
          { status: 403 },
        );
      }
      userId = session.user.id;
      bookingStatus = "confirmed";
      paymentStatus = "paid";
    } else {
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Please log in or book as a guest" },
          { status: 401 },
        );
      }
      userId = session.user.id;
      bookingStatus = "pending";
      paymentStatus = "pending";
    }

    const bookingDate = new Date(date);
    const dayOfWeek = bookingDate.getDay();

    const [recurringConflicts, lessonSessions] = await Promise.all([
      prisma.recurringBooking.findMany({
        where: {
          dayOfWeek,
          isActive: true,
          startDate: { lte: bookingDate },
          OR: [{ endDate: null }, { endDate: { gte: bookingDate } }],
        },
      }),
      prisma.lessonSession.findMany({
        where: {
          lessonDate: bookingDate,
          status: "scheduled",
        },
        select: {
          courtId: true,
          startTime: true,
          endTime: true,
        },
      }),
    ]);

    const recurringSlotSet = new Set(
      recurringConflicts.map((r) => `${r.courtId}-${r.startTime}`),
    );

    const hasRecurringConflict = slots.some(
      (slot: { courtId: number; slotTime: string }) =>
        recurringSlotSet.has(`${slot.courtId}-${slot.slotTime}`),
    );

    if (hasRecurringConflict) {
      return NextResponse.json(
        { error: "One or more slots conflict with a recurring booking" },
        { status: 409 },
      );
    }

    const hasLessonConflict = slots.some(
      (slot: { courtId: number; slotTime: string }) => {
        const slotEnd = getEndTime(slot.slotTime);
        return lessonSessions.some(
          (lesson) =>
            lesson.courtId === slot.courtId &&
            timeToMinutes(slot.slotTime) < timeToMinutes(lesson.endTime) &&
            timeToMinutes(slotEnd) > timeToMinutes(lesson.startTime),
        );
      },
    );

    if (hasLessonConflict) {
      return NextResponse.json(
        { error: "One or more slots conflict with a scheduled lesson" },
        { status: 409 },
      );
    }

    let createdBookings;
    try {
      createdBookings = await prisma.$transaction(async (tx) => {
        const existingBookings = await tx.booking.findMany({
          where: {
            bookingDate,
            status: { in: ["pending", "confirmed"] },
            OR: slots.map((slot: { courtId: number; slotTime: string }) => ({
              courtId: slot.courtId,
              startTime: slot.slotTime,
            })),
          },
        });

        if (existingBookings.length > 0) {
          throw new Error("SLOT_CONFLICT");
        }

        const txLessonSessions = await tx.lessonSession.findMany({
          where: {
            lessonDate: bookingDate,
            status: "scheduled",
          },
          select: { courtId: true, startTime: true, endTime: true },
        });

        const txLessonConflict = slots.some(
          (slot: { courtId: number; slotTime: string }) => {
            const slotEnd = getEndTime(slot.slotTime);
            return txLessonSessions.some(
              (lesson) =>
                lesson.courtId === slot.courtId &&
                timeToMinutes(slot.slotTime) < timeToMinutes(lesson.endTime) &&
                timeToMinutes(slotEnd) > timeToMinutes(lesson.startTime),
            );
          },
        );

        if (txLessonConflict) {
          throw new Error("LESSON_CONFLICT");
        }

        const bookings = [];
        for (const slot of slots as { courtId: number; slotTime: string }[]) {
          const endTime = getEndTime(slot.slotTime);
          const totalAmount = calculateBookingAmount(
            slot.slotTime,
            endTime,
            validatedSport,
          );
          const now = new Date();
          const booking = await tx.booking.create({
            data: {
              userId,
              courtId: slot.courtId,
              sport: validatedSport,
              bookingDate,
              startTime: slot.slotTime,
              endTime,
              totalAmount,
              status: bookingStatus,
              paymentStatus,
              paymentMethod: paymentMethod || null,
              paymentUserConfirmed: paymentUserConfirmed || false,
              paymentScreenshotUrl: receiptUrl || null,
              guestName: bookingGuestName,
              guestPhone: bookingGuestPhone,
              guestEmail: bookingGuestEmail,
              expiresAt: paymentStatus === "pending" ? calculatePaymentDeadline(now) : null,
            },
            include: {
              court: true,
            },
          });
          bookings.push(booking);
        }
        return bookings;
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "SLOT_CONFLICT") {
        return NextResponse.json(
          { error: "One or more slots are no longer available" },
          { status: 409 },
        );
      }
      if (error instanceof Error && error.message === "LESSON_CONFLICT") {
        return NextResponse.json(
          { error: "One or more slots conflict with a scheduled lesson" },
          { status: 409 },
        );
      }
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        return NextResponse.json(
          {
            error:
              "This slot was just booked by someone else. Please select another time.",
          },
          { status: 409 },
        );
      }
      throw error;
    }

    return NextResponse.json(
      {
        message: "Booking created successfully",
        bookings: createdBookings,
        bookingIds: createdBookings.map((b) => b.id),
        count: createdBookings.length,
        expiresAt: createdBookings[0]?.expiresAt || null,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function getEndTime(startTime: string): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  let endMinutes = minutes + 30;
  let endHours = hours;
  if (endMinutes >= 60) {
    endMinutes = 0;
    endHours = hours + 1;
  }
  return `${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`;
}
