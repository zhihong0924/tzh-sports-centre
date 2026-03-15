import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/blob-upload";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;

    const enrollment = await prisma.lessonEnrollment.findUnique({
      where: { lessonSessionId_userId: { lessonSessionId: id, userId } },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: "Enrollment not found" },
        { status: 404 }
      );
    }

    if (enrollment.status === "PAID") {
      return NextResponse.json(
        { error: "Payment already confirmed" },
        { status: 400 }
      );
    }

    if (enrollment.status === "CANCELLED" || enrollment.status === "REJECTED") {
      return NextResponse.json(
        { error: "Cannot upload receipt for a cancelled or rejected enrollment" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload JPG, PNG, or WebP." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const ext = file.type.split("/")[1] || "jpg";
    const filename = `receipts/lesson_enrollment_${enrollment.id}_${timestamp}.${ext}`;

    const blob = await uploadFile(file, filename);

    await prisma.lessonEnrollment.update({
      where: { id: enrollment.id },
      data: { receiptUrl: blob.url },
    });

    return NextResponse.json({
      success: true,
      receiptUrl: blob.url,
      message: "Receipt uploaded. Awaiting admin verification.",
    });
  } catch (error) {
    console.error("Error uploading enrollment receipt:", error);
    return NextResponse.json(
      { error: "Failed to upload receipt" },
      { status: 500 }
    );
  }
}
