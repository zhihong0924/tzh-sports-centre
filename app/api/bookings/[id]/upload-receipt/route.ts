import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/blob-upload";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Find the booking
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        paymentStatus: true,
        expiresAt: true,
        paymentExempt: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 },
      );
    }

    // Only the owner can upload a receipt
    if (booking.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if booking is already paid or expired
    if (booking.status === "expired") {
      return NextResponse.json(
        { error: "This booking has expired. Please create a new booking." },
        { status: 410 },
      );
    }

    if (booking.paymentStatus === "paid") {
      return NextResponse.json(
        { error: "Payment has already been confirmed for this booking." },
        { status: 400 },
      );
    }

    // Check 15-minute payment window
    if (booking.expiresAt && new Date() > new Date(booking.expiresAt)) {
      // Mark as expired
      await prisma.booking.update({
        where: { id },
        data: { status: "expired", expiredAt: new Date() },
      });
      return NextResponse.json(
        { error: "Payment window has expired. Please create a new booking." },
        { status: 410 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload JPG, PNG, or WebP." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 },
      );
    }

    const timestamp = Date.now();
    const ext = file.type.split("/")[1] || "jpg";
    const filename = `receipts/booking_${id}_${timestamp}.${ext}`;

    const blob = await uploadFile(file, filename);

    // Update booking with receipt
    await prisma.booking.update({
      where: { id },
      data: {
        paymentScreenshotUrl: blob.url,
        receiptVerificationStatus: "pending_verification",
        paymentUserConfirmed: true,
      },
    });

    return NextResponse.json({
      success: true,
      receiptUrl: blob.url,
      message: "Receipt uploaded. Awaiting admin verification.",
    });
  } catch (error) {
    console.error("Error uploading receipt:", error);
    return NextResponse.json(
      { error: "Failed to upload receipt" },
      { status: 500 },
    );
  }
}
