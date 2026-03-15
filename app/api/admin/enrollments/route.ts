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

    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const status = request.nextUrl.searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (sessionId) where.lessonSessionId = sessionId;
    if (status) where.status = status;

    const enrollments = await prisma.lessonEnrollment.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        lessonSession: {
          select: {
            id: true,
            lessonDate: true,
            startTime: true,
            endTime: true,
            lessonType: true,
            court: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(enrollments);
  } catch (error) {
    console.error("Error fetching enrollments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
