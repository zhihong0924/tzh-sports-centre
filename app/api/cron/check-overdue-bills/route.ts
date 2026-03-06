import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    // Check the previous month for unpaid bills
    const now = new Date();
    let checkMonth = now.getMonth(); // 0-indexed = previous month
    let checkYear = now.getFullYear();
    if (checkMonth === 0) {
      checkMonth = 12;
      checkYear -= 1;
    }

    const monthName = MONTH_NAMES[checkMonth - 1];

    const unpaidPayments = await prisma.monthlyPayment.findMany({
      where: {
        month: checkMonth,
        year: checkYear,
        status: { not: "paid" },
      },
      include: {
        user: {
          select: { id: true, uid: true, name: true, email: true },
        },
      },
    });

    if (unpaidPayments.length === 0) {
      return NextResponse.json({ success: true, notified: 0 });
    }

    // Get all admins for the admin alert
    const admins = await prisma.user.findMany({
      where: { isAdmin: true, deletedAt: null },
      select: { id: true },
    });

    let notified = 0;

    for (const payment of unpaidPayments) {
      const unpaidAmount = payment.totalAmount - payment.paidAmount;
      if (unpaidAmount <= 0) continue;

      const amountStr = unpaidAmount.toFixed(2);
      const notifKey = `${checkYear}-${checkMonth}`;

      // Skip if overdue notification already sent to this student
      const existing = await prisma.notification.findFirst({
        where: {
          userId: payment.user.id,
          type: "payment_overdue",
          message: { contains: notifKey },
        },
      });

      if (!existing) {
        await prisma.notification.create({
          data: {
            userId: payment.user.id,
            type: "payment_overdue",
            title: "Payment Overdue",
            message: `Your payment of RM${amountStr} for ${monthName} ${checkYear} is overdue. Please pay now.`,
            link: "/profile?tab=billing",
          },
        });

        // Alert all admins
        for (const admin of admins) {
          const uid = payment.user.uid.toString().padStart(3, "0");
          await prisma.notification.create({
            data: {
              userId: admin.id,
              type: "admin_overdue_alert",
              title: "Overdue Payment Alert",
              message: `${payment.user.name} (UID ${uid}) has an overdue payment of RM${amountStr} for ${monthName} ${checkYear}.`,
              link: "/admin/payments",
            },
          });
        }

        notified++;
      }
    }

    return NextResponse.json({ success: true, notified, checked: unpaidPayments.length });
  } catch (error) {
    console.error("Check overdue bills cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
