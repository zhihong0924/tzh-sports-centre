import { NextRequest, NextResponse } from "next/server";
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

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const startDate = fromZonedTime(new Date(year, month - 1, 1), TIMEZONE);
    const endDate = fromZonedTime(new Date(year, month, 1), TIMEZONE);

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

    let generated = 0;
    let skipped = 0;

    for (const user of usersWithBookings) {
      const existing = user.monthlyPayments[0];
      if (existing && existing.status !== "unpaid") {
        skipped++;
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
        skipped++;
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
        update: { totalAmount, bookingsCount, totalHours },
      });

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

      generated++;
    }

    return NextResponse.json({ success: true, generated, skipped });
  } catch (error) {
    console.error("Generate recurring bills cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
