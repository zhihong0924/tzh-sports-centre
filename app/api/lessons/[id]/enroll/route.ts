import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;

    const lesson = await prisma.lessonSession.findUnique({
      where: { id },
      include: {
        students: { select: { id: true } },
        enrollments: {
          where: { status: { in: ["PENDING_PAYMENT", "PAID"] } },
          select: { userId: true },
        },
        _count: { select: { students: true } },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    if (!lesson.isOpenEnrollment) {
      return NextResponse.json(
        { error: "This lesson is not open for enrollment" },
        { status: 400 }
      );
    }

    if (lesson.status !== "scheduled") {
      return NextResponse.json(
        { error: "This lesson is no longer available" },
        { status: 400 }
      );
    }

    const lessonDate = new Date(lesson.lessonDate);
    lessonDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (lessonDate < today) {
      return NextResponse.json(
        { error: "Cannot enroll in a past lesson" },
        { status: 400 }
      );
    }

    // Check if already a direct student
    if (lesson.students.some((s) => s.id === userId)) {
      return NextResponse.json(
        { error: "You are already assigned to this lesson" },
        { status: 400 }
      );
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.lessonEnrollment.findUnique({
      where: { lessonSessionId_userId: { lessonSessionId: id, userId } },
    });

    if (existingEnrollment) {
      if (
        existingEnrollment.status === "PENDING_PAYMENT" ||
        existingEnrollment.status === "PAID"
      ) {
        return NextResponse.json(
          { error: "You are already enrolled in this lesson" },
          { status: 400 }
        );
      }
      // Cancelled/rejected — allow re-enrollment
    }

    // Get lesson type for maxStudents
    const lessonTypeRecord = await prisma.lessonType.findUnique({
      where: { slug: lesson.lessonType },
      select: { maxStudents: true },
    });
    const maxStudents = lessonTypeRecord?.maxStudents ?? 999;

    const totalOccupied =
      lesson._count.students + lesson.enrollments.length;
    if (totalOccupied >= maxStudents) {
      return NextResponse.json(
        { error: "This lesson is fully booked" },
        { status: 400 }
      );
    }

    const amountDue =
      lesson.pricePerStudent ??
      lesson.price / Math.max(maxStudents, 1);

    let enrollment;
    if (existingEnrollment) {
      enrollment = await prisma.lessonEnrollment.update({
        where: { id: existingEnrollment.id },
        data: {
          status: "PENDING_PAYMENT",
          amountDue,
          receiptUrl: null,
          adminNotes: null,
          reviewedAt: null,
          reviewedBy: null,
        },
      });
    } else {
      enrollment = await prisma.lessonEnrollment.create({
        data: {
          lessonSessionId: id,
          userId,
          status: "PENDING_PAYMENT",
          amountDue,
        },
      });
    }

    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (error) {
    console.error("Error enrolling in lesson:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
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
        { error: "Cannot cancel a confirmed enrollment. Please contact admin." },
        { status: 400 }
      );
    }

    await prisma.lessonEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling enrollment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
