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

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json();
    const { month, year, amount, paymentMethod, receiptUrl, notes } = body;

    if (!month || !year || !amount || !paymentMethod || !receiptUrl) {
      return NextResponse.json(
        { error: "Missing required fields: month, year, amount, paymentMethod, receiptUrl" },
        { status: 400 },
      );
    }

    if (!["tng", "duitnow", "bank_transfer"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const startDate = fromZonedTime(new Date(year, month - 1, 1), TIMEZONE);
    const endDate = fromZonedTime(new Date(year, month, 1), TIMEZONE);

    // Calculate totalAmount for this user/month
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        bookings: {
          where: {
            bookingDate: { gte: startDate, lt: endDate },
            status: { not: "cancelled" },
          },
        },
        recurringBookings: {
          where: {
            isActive: true,
            startDate: { lte: endDate },
            OR: [{ endDate: null }, { endDate: { gte: startDate } }],
          },
          include: { court: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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

    const lessonBillingMap = await getLessonBillingForMonth(month, year, [userId]);
    const lessonBilling = lessonBillingMap.get(userId);
    totalAmount += lessonBilling?.totalAmount || 0;
    totalHours += lessonBilling?.totalHours || 0;

    // Upsert MonthlyPayment (don't overwrite paidAmount if already partial/paid)
    const existing = await prisma.monthlyPayment.findUnique({
      where: { userId_month_year: { userId, month, year } },
    });

    const payment = await prisma.monthlyPayment.upsert({
      where: { userId_month_year: { userId, month, year } },
      create: {
        userId,
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

    // Rate limit: one pending receipt per user/month
    const existingPending = await prisma.paymentTransaction.findFirst({
      where: {
        monthlyPaymentId: payment.id,
        verificationStatus: "pending_verification",
      },
    });

    if (existingPending) {
      return NextResponse.json(
        { error: "You already have a receipt pending review for this month. Please wait for admin approval." },
        { status: 409 },
      );
    }

    const transaction = await prisma.paymentTransaction.create({
      data: {
        monthlyPaymentId: payment.id,
        amount: amountNum,
        paymentMethod,
        notes: notes || null,
        receiptUrl,
        verificationStatus: "pending_verification",
        recordedBy: session.user.email || userId,
      },
    });

    return NextResponse.json({ success: true, transactionId: transaction.id });
  } catch (error) {
    console.error("Error submitting receipt:", error);
    return NextResponse.json({ error: "Failed to submit receipt" }, { status: 500 });
  }
}

// Allow student to delete a pending (not yet reviewed) receipt
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get("transactionId");
    if (!transactionId) {
      return NextResponse.json({ error: "transactionId required" }, { status: 400 });
    }

    const tx = await prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
      include: { monthlyPayment: true },
    });

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    if (tx.monthlyPayment.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (tx.verificationStatus !== "pending_verification") {
      return NextResponse.json(
        { error: "Cannot delete a receipt that has already been reviewed" },
        { status: 400 },
      );
    }

    await prisma.paymentTransaction.delete({ where: { id: transactionId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting receipt:", error);
    return NextResponse.json({ error: "Failed to delete receipt" }, { status: 500 });
  }
}
