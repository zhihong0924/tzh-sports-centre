import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const enrollments = await prisma.lessonEnrollment.findMany({
      where: {
        userId: session.user.id,
        status: { not: "CANCELLED" },
      },
      include: {
        lessonSession: {
          select: {
            id: true,
            lessonDate: true,
            startTime: true,
            endTime: true,
            lessonType: true,
            duration: true,
            status: true,
            notes: true,
            court: { select: { name: true } },
            teacher: { select: { name: true } },
          },
        },
      },
      orderBy: { lessonSession: { lessonDate: "asc" } },
    });

    return NextResponse.json({ enrollments });
  } catch (error) {
    console.error("Error fetching lesson enrollments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
