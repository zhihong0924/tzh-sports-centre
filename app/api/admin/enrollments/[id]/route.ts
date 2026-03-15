import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user.email, session.user.isAdmin)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, adminNotes } = body;

    if (!["PAID", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "Status must be PAID or REJECTED" },
        { status: 400 }
      );
    }

    const enrollment = await prisma.lessonEnrollment.findUnique({
      where: { id },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: "Enrollment not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.lessonEnrollment.update({
      where: { id },
      data: {
        status,
        adminNotes: adminNotes ?? enrollment.adminNotes,
        reviewedAt: new Date(),
        reviewedBy: session.user.email ?? session.user.id,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        lessonSession: {
          select: {
            id: true,
            lessonDate: true,
            startTime: true,
            lessonType: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating enrollment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
