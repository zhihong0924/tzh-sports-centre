import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { fromZonedTime } from "date-fns-tz";
import {
  calculateHours,
  calculateBookingAmount,
  countSessionsInMonth,
} from "@/lib/recurring-booking-utils";
import { getLessonBillingForMonth } from "@/lib/lesson-billing-utils";

const TIMEZONE = "Asia/Kuala_Lumpur";
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user.email, session.user.isAdmin)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const month = parseInt(body.month);
    const year = parseInt(body.year);

    if (!month || !year || month < 1 || month > 12) {
      return NextResponse.json({ error: "Invalid month or year" }, { status: 400 });
    }

    const startDate = fromZonedTime(new Date(year, month - 1, 1), TIMEZONE);
    const endDate = fromZonedTime(new Date(year, month, 1), TIMEZONE);

    // Find all users with active recurring bookings this month
    const usersWithBookings = await prisma.user.findMany({
      where: {
        recurringBookings: {
          some: {
            isActive: true,
            startDate: { lte: endDate },
            OR: [{ endDate: null }, { endDate: { gte: startDate } }],
          },
        },
      },
      include: {
        recurringBookings: {
          where: {
            isActive: true,
            startDate: { lte: endDate },
            OR: [{ endDate: null }, { endDate: { gte: startDate } }],
          },
          include: { court: true },
        },
        bookings: {
          where: {
            bookingDate: { gte: startDate, lt: endDate },
            status: { not: "cancelled" },
          },
        },
        monthlyPayments: { where: { month, year } },
      },
    });

    const allUserIds = usersWithBookings.map((u) => u.id);
    const lessonBillingMap = await getLessonBillingForMonth(month, year, allUserIds);

    const generated: string[] = [];
    const skipped: string[] = [];

    for (const user of usersWithBookings) {
      const existing = user.monthlyPayments[0];

      // Skip if already fully or partially paid — don't overwrite
      if (existing && existing.status !== "unpaid") {
        skipped.push(user.name);
        continue;
      }

      let totalAmount = 0;
      let totalHours = 0;
      let bookingsCount = user.bookings.length;

      for (const booking of user.bookings) {
        totalAmount += booking.totalAmount;
        totalHours += calculateHours(booking.startTime, booking.endTime);
      }

      for (const rb of user.recurringBookings) {
        const sessions = countSessionsInMonth(year, month, rb.dayOfWeek);
        const hours = calculateHours(rb.startTime, rb.endTime);
        const amountPerSession = rb.hourlyRate
          ? hours * rb.hourlyRate
          : calculateBookingAmount(rb.startTime, rb.endTime, rb.sport);
        totalAmount += sessions * amountPerSession;
        totalHours += sessions * hours;
        bookingsCount += sessions;
      }

      const lessonBilling = lessonBillingMap.get(user.id);
      totalAmount += lessonBilling?.totalAmount || 0;
      totalHours += lessonBilling?.totalHours || 0;

      if (totalAmount <= 0) {
        skipped.push(user.name);
        continue;
      }

      const monthName = MONTH_NAMES[month - 1];
      const amountStr = totalAmount.toFixed(2);

      await prisma.monthlyPayment.upsert({
        where: { userId_month_year: { userId: user.id, month, year } },
        create: {
          userId: user.id,
          month,
          year,
          totalAmount,
          paidAmount: 0,
          bookingsCount,
          totalHours,
          status: "unpaid",
        },
        update: {
          totalAmount,
          bookingsCount,
          totalHours,
        },
      });

      // Create notification if not already sent for this month
      const existingNotif = await prisma.notification.findFirst({
        where: {
          userId: user.id,
          type: "billing_generated",
          message: { contains: `${monthName} ${year}` },
        },
      });

      if (!existingNotif) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: "billing_generated",
            title: "Monthly Bill Generated",
            message: `Your recurring booking bill for ${monthName} ${year} is RM${amountStr}. Due by the 3rd.`,
            link: "/profile?tab=billing",
          },
        });
      }

      generated.push(user.name);
    }

    return NextResponse.json({
      success: true,
      generated: generated.length,
      skipped: skipped.length,
      users: generated,
    });
  } catch (error) {
    console.error("Error generating monthly bills:", error);
    return NextResponse.json({ error: "Failed to generate bills" }, { status: 500 });
  }
}
