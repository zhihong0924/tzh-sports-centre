import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user.email, session.user.isAdmin)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { transactionId, action, amount, paymentMethod } = body;

    if (!transactionId || !action) {
      return NextResponse.json(
        { error: "Missing required fields: transactionId, action" },
        { status: 400 },
      );
    }
    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
    }

    const tx = await prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
      include: { monthlyPayment: true },
    });

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    if (tx.verificationStatus !== "pending_verification") {
      return NextResponse.json(
        { error: "Transaction is not pending verification" },
        { status: 400 },
      );
    }

    if (action === "reject") {
      await prisma.paymentTransaction.update({
        where: { id: transactionId },
        data: { verificationStatus: "rejected" },
      });
      return NextResponse.json({ success: true, action: "rejected" });
    }

    // Approve: record the payment on the MonthlyPayment
    const approvedAmount = amount ? parseFloat(amount) : tx.amount;
    const approvedMethod = paymentMethod || tx.paymentMethod;

    if (isNaN(approvedAmount) || approvedAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const mp = tx.monthlyPayment;
    const newPaidAmount = mp.paidAmount + approvedAmount;
    const newStatus =
      newPaidAmount >= mp.totalAmount
        ? "paid"
        : newPaidAmount > 0
          ? "partial"
          : "unpaid";

    await prisma.$transaction([
      prisma.monthlyPayment.update({
        where: { id: mp.id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
          markedPaidBy: newStatus === "paid" ? session.user!.email : undefined,
          markedPaidAt: newStatus === "paid" ? new Date() : undefined,
        },
      }),
      prisma.paymentTransaction.update({
        where: { id: transactionId },
        data: {
          amount: approvedAmount,
          paymentMethod: approvedMethod,
          verificationStatus: "approved",
        },
      }),
    ]);

    return NextResponse.json({ success: true, action: "approved", paidAmount: newPaidAmount });
  } catch (error) {
    console.error("Error verifying receipt:", error);
    return NextResponse.json({ error: "Failed to verify receipt" }, { status: 500 });
  }
}
