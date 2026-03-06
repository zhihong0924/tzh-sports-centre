import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user.email, session.user.isAdmin)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lookbackMonths = parseInt(searchParams.get("months") || "6");

    // Query existing MonthlyPayment records where status != paid
    // No live recalculation — uses stored records for performance
    const unpaidPayments = await prisma.monthlyPayment.findMany({
      where: { status: { not: "paid" } },
      include: {
        user: {
          select: { id: true, uid: true, name: true, email: true, phone: true },
        },
        transactions: { orderBy: { recordedAt: "desc" }, take: 5 },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    // Filter to lookback window
    const now = new Date();
    const inWindow = unpaidPayments.filter((p) => {
      const monthsAgo =
        (now.getFullYear() - p.year) * 12 + (now.getMonth() + 1 - p.month);
      return monthsAgo <= lookbackMonths && monthsAgo >= 0;
    });

    // Group by user
    const byUser = new Map<
      string,
      {
        userId: string;
        uid: string;
        name: string;
        email: string;
        phone: string | null;
        totalOwed: number;
        months: Array<{
          month: number;
          year: number;
          totalAmount: number;
          paidAmount: number;
          unpaidAmount: number;
          status: string;
          paymentId: string;
          transactions: (typeof unpaidPayments)[0]["transactions"];
        }>;
      }
    >();

    for (const p of inWindow) {
      const unpaidAmount = p.totalAmount - p.paidAmount;
      if (unpaidAmount <= 0) continue;

      if (!byUser.has(p.userId)) {
        byUser.set(p.userId, {
          userId: p.userId,
          uid: p.user.uid.toString().padStart(3, "0"),
          name: p.user.name,
          email: p.user.email,
          phone: p.user.phone,
          totalOwed: 0,
          months: [],
        });
      }
      const entry = byUser.get(p.userId)!;
      entry.totalOwed += unpaidAmount;
      entry.months.push({
        month: p.month,
        year: p.year,
        totalAmount: p.totalAmount,
        paidAmount: p.paidAmount,
        unpaidAmount,
        status: p.status,
        paymentId: p.id,
        transactions: p.transactions,
      });
    }

    const users = Array.from(byUser.values()).sort(
      (a, b) => b.totalOwed - a.totalOwed,
    );

    // Build matrix: distinct months across all users
    const monthSet = new Set<string>();
    for (const u of users) {
      for (const m of u.months)
        monthSet.add(`${m.year}-${String(m.month).padStart(2, "0")}`);
    }
    const matrixMonths = Array.from(monthSet)
      .sort()
      .reverse()
      .slice(0, lookbackMonths);

    return NextResponse.json({ users, matrixMonths, total: users.length });
  } catch (error) {
    console.error("Error fetching outstanding payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch outstanding payments" },
      { status: 500 },
    );
  }
}
