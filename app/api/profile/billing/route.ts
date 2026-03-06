import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fromZonedTime } from "date-fns-tz";
import {
  calculateHours,
  calculateBookingAmount,
  countSessionsInMonth,
} from "@/lib/recurring-booking-utils";
import { getLessonBillingForMonth } from "@/lib/lesson-billing-utils";

const TIMEZONE = "Asia/Kuala_Lumpur";

function getMonthDateRange(month: number, year: number) {
  const startDate = fromZonedTime(new Date(year, month - 1, 1), TIMEZONE);
  const endDate = fromZonedTime(new Date(year, month, 1), TIMEZONE);
  return { startDate, endDate };
}

function monthName(month: number, year: number): string {
  return new Date(year, month - 1, 1).toLocaleString("en-MY", {
    month: "long",
    year: "numeric",
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const summaryOnly = searchParams.get("summary") === "true";
    const allUnpaid = searchParams.get("all_unpaid") === "true";

    // ─── ?all_unpaid=true — return months with outstanding balances ───────────
    if (allUnpaid) {
      const unpaidPayments = await prisma.monthlyPayment.findMany({
        where: {
          userId,
          status: { not: "paid" },
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      });

      const result = unpaidPayments
        .filter((p) => p.totalAmount - p.paidAmount > 0)
        .map((p) => ({
          month: p.month,
          year: p.year,
          totalAmount: p.totalAmount,
          paidAmount: p.paidAmount,
          unpaidAmount: p.totalAmount - p.paidAmount,
          status: p.status,
        }));

      return NextResponse.json(result);
    }

    // ─── Single-month billing ─────────────────────────────────────────────────
    const now = new Date();
    const month = parseInt(
      searchParams.get("month") || String(now.getMonth() + 1),
    );
    const year = parseInt(
      searchParams.get("year") || String(now.getFullYear()),
    );

    const { startDate, endDate } = getMonthDateRange(month, year);

    // Fetch MonthlyPayment record if it exists
    const monthlyPayment = await prisma.monthlyPayment.findUnique({
      where: { userId_month_year: { userId, month, year } },
      include: { transactions: { orderBy: { recordedAt: "asc" } } },
    });

    // ─── Calculate booking charges ────────────────────────────────────────────
    const [bookings, recurringBookings] = await Promise.all([
      prisma.booking.findMany({
        where: {
          userId,
          bookingDate: { gte: startDate, lt: endDate },
          status: { not: "cancelled" },
        },
        include: { court: true },
        orderBy: { bookingDate: "asc" },
      }),
      prisma.recurringBooking.findMany({
        where: {
          userId,
          isActive: true,
          startDate: { lte: endDate },
          OR: [{ endDate: null }, { endDate: { gte: startDate } }],
        },
        include: { court: true },
      }),
    ]);

    // ─── Calculate lesson charges ─────────────────────────────────────────────
    const lessonBillingMap = await getLessonBillingForMonth(month, year, [
      userId,
    ]);
    const lessonBilling = lessonBillingMap.get(userId);

    // ─── Calculate shop order charges ─────────────────────────────────────────
    const shopOrders = await prisma.shopOrder.findMany({
      where: {
        userId,
        paymentStatus: { not: "paid" },
        createdAt: { gte: startDate, lt: endDate },
      },
      orderBy: { createdAt: "asc" },
    });

    // ─── Aggregate totals ─────────────────────────────────────────────────────
    let bookingTotal = 0;
    let recurringTotal = 0;
    let shopTotal = 0;

    for (const b of bookings) {
      bookingTotal += b.totalAmount;
    }

    for (const rb of recurringBookings) {
      const sessions = countSessionsInMonth(year, month, rb.dayOfWeek);
      const hours = calculateHours(rb.startTime, rb.endTime);
      const amountPerSession = rb.hourlyRate
        ? hours * rb.hourlyRate
        : calculateBookingAmount(rb.startTime, rb.endTime, rb.sport);
      recurringTotal += sessions * amountPerSession;
    }

    for (const so of shopOrders) {
      shopTotal += so.total;
    }

    const lessonTotal = lessonBilling?.totalAmount || 0;
    const totalAmount = bookingTotal + recurringTotal + lessonTotal + shopTotal;

    // Paid amount from MonthlyPayment (covers bookings + recurring + lessons)
    // Shop orders track their own payment status separately
    const paidAmount = monthlyPayment?.paidAmount || 0;
    const mainUnpaid = Math.max(
      0,
      bookingTotal + recurringTotal + lessonTotal - paidAmount,
    );
    const unpaidAmount = mainUnpaid + shopTotal;
    const status =
      monthlyPayment?.status || (totalAmount > 0 ? "unpaid" : "no-activity");

    // ─── Summary-only mode ────────────────────────────────────────────────────
    if (summaryOnly) {
      return NextResponse.json({
        month,
        year,
        totalAmount,
        paidAmount,
        unpaidAmount,
        status,
        monthlyPaymentId: monthlyPayment?.id || null,
      });
    }

    // ─── Full breakdown ───────────────────────────────────────────────────────
    const breakdown: Array<{
      type: "booking" | "recurring" | "lesson" | "shop";
      date: string;
      description: string;
      amount: number;
      details?: Record<string, unknown>;
    }> = [];

    for (const b of bookings) {
      breakdown.push({
        type: "booking",
        date: b.bookingDate.toISOString().split("T")[0],
        description: `${b.court.name} — ${b.startTime}–${b.endTime} (${b.sport})`,
        amount: b.totalAmount,
        details: { courtId: b.courtId, sport: b.sport },
      });
    }

    for (const rb of recurringBookings) {
      const sessions = countSessionsInMonth(year, month, rb.dayOfWeek);
      const hours = calculateHours(rb.startTime, rb.endTime);
      const amountPerSession = rb.hourlyRate
        ? hours * rb.hourlyRate
        : calculateBookingAmount(rb.startTime, rb.endTime, rb.sport);
      const total = sessions * amountPerSession;
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      breakdown.push({
        type: "recurring",
        date: `${year}-${String(month).padStart(2, "0")}-01`,
        description: `${rb.court.name} — Every ${dayNames[rb.dayOfWeek]} ${rb.startTime}–${rb.endTime} × ${sessions} sessions`,
        amount: total,
        details: { sessions, amountPerSession, dayOfWeek: rb.dayOfWeek },
      });
    }

    if (lessonBilling) {
      for (const item of lessonBilling.items) {
        breakdown.push({
          type: "lesson",
          date: item.lessonDate,
          description: `Lesson — ${item.startTime}–${item.endTime} (${item.lessonType})`,
          amount: item.amount,
          details: {
            billingType: item.billingType,
            court: item.court,
            attended: item.attended,
          },
        });
      }
    }

    for (const so of shopOrders) {
      breakdown.push({
        type: "shop",
        date: so.createdAt.toISOString().split("T")[0],
        description: `Shop order — ${so.customerName}`,
        amount: so.total,
        details: { orderId: so.id, paymentStatus: so.paymentStatus },
      });
    }

    // Sort breakdown by date
    breakdown.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      month,
      year,
      monthName: monthName(month, year),
      totalAmount,
      paidAmount,
      unpaidAmount,
      status,
      monthlyPaymentId: monthlyPayment?.id || null,
      breakdown,
      transactions: monthlyPayment?.transactions || [],
      summary: {
        bookingTotal,
        recurringTotal,
        lessonTotal,
        shopTotal,
      },
    });
  } catch (error) {
    console.error("Error fetching billing:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing" },
      { status: 500 },
    );
  }
}
