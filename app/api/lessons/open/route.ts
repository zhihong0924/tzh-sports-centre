import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // Get current date at midnight UTC matching Malaysia date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessions = await prisma.lessonSession.findMany({
      where: {
        isOpenEnrollment: true,
        status: "scheduled",
        lessonDate: { gte: today },
      },
      include: {
        court: { select: { id: true, name: true } },
        teacher: { select: { id: true, name: true } },
        students: { select: { id: true } },
        enrollments: {
          where: { status: { in: ["PENDING_PAYMENT", "PAID"] } },
          select: {
            id: true,
            userId: true,
            status: true,
            amountDue: true,
            receiptUrl: true,
          },
        },
        _count: { select: { students: true } },
      },
      orderBy: [{ lessonDate: "asc" }, { startTime: "asc" }],
    });

    const userId = session?.user?.id;

    const result = sessions.map((s) => {
      // Get lesson type config to find maxStudents
      const paidEnrollments = s.enrollments.filter(
        (e) => e.status === "PAID"
      ).length;
      const pendingEnrollments = s.enrollments.filter(
        (e) => e.status === "PENDING_PAYMENT"
      ).length;
      const directStudentCount = s._count.students;

      // My enrollment (if authenticated)
      const myEnrollment = userId
        ? s.enrollments.find((e) => e.userId === userId)
        : null;

      return {
        id: s.id,
        lessonDate: s.lessonDate,
        startTime: s.startTime,
        endTime: s.endTime,
        lessonType: s.lessonType,
        duration: s.duration,
        price: s.price,
        pricePerStudent: s.pricePerStudent,
        status: s.status,
        notes: s.notes,
        court: s.court,
        teacher: s.teacher,
        directStudentCount,
        paidEnrollments,
        pendingEnrollments,
        myEnrollment: myEnrollment
          ? {
              id: myEnrollment.id,
              status: myEnrollment.status,
              amountDue: myEnrollment.amountDue,
              receiptUrl: myEnrollment.receiptUrl,
            }
          : null,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching open lessons:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
