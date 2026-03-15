import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { validateFutureDate } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || !isAdmin(session.user.email, session.user.isAdmin)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date");
    const month = searchParams.get("month");
    const memberId = searchParams.get("memberId");
    const upcoming = searchParams.get("upcoming");
    const limitParam = searchParams.get("limit");
    const lessonId = searchParams.get("lessonId");

    // Fetch a single lesson by ID
    if (lessonId) {
      const lesson = await prisma.lessonSession.findUnique({
        where: { id: lessonId },
        include: {
          court: true,
          teacher: { select: { id: true, name: true } },
          students: { select: { id: true, name: true, phone: true, skillLevel: true } },
          enrollments: {
            select: {
              id: true, status: true, amountDue: true, receiptUrl: true,
              user: { select: { id: true, name: true, phone: true, email: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!lesson) {
        return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
      }
      return NextResponse.json({ lesson });
    }

    const where: Record<string, unknown> = {};

    if (date) {
      where.lessonDate = new Date(date);
    } else if (month) {
      const [year, monthNum] = month.split("-").map(Number);
      const startOfMonth = new Date(year, monthNum - 1, 1);
      const endOfMonth = new Date(year, monthNum, 0);
      where.lessonDate = {
        gte: startOfMonth,
        lte: endOfMonth,
      };
    } else if (upcoming === "true") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.lessonDate = { gte: today };
      where.status = { not: "cancelled" };
    }

    if (memberId) {
      where.students = {
        some: { id: memberId },
      };
    }

    const lessons = await prisma.lessonSession.findMany({
      where,
      take: limitParam ? parseInt(limitParam) : undefined,
      include: {
        court: true,
        teacher: { select: { id: true, name: true } },
        students: {
          select: {
            id: true,
            name: true,
            phone: true,
            skillLevel: true,
          },
        },
        attendances: {
          select: {
            userId: true,
            status: true,
          },
        },
        enrollments: {
          select: {
            id: true,
            status: true,
            amountDue: true,
            receiptUrl: true,
            user: {
              select: { id: true, name: true, phone: true, email: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ lessonDate: upcoming === "true" ? "asc" : "desc" }, { startTime: "asc" }],
    });

    return NextResponse.json({ lessons });
  } catch (error) {
    console.error("Error fetching lessons:", error);
    return NextResponse.json(
      { error: "Failed to fetch lessons" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || !isAdmin(session.user.email, session.user.isAdmin)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      courtId,
      lessonDate,
      startTime,
      lessonType,
      duration,
      studentIds,
      notes,
      teacherId,
      isOpenEnrollment,
      pricePerStudent,
    } = body;

    const ids: string[] = studentIds || [];

    if (
      !courtId ||
      !lessonDate ||
      !startTime ||
      !lessonType
    ) {
      return NextResponse.json(
        {
          error:
            "Court, date, time, and lesson type are required",
        },
        { status: 400 },
      );
    }

    if (!validateFutureDate(lessonDate)) {
      return NextResponse.json(
        { error: "Lesson date cannot be in the past" },
        { status: 400 },
      );
    }

    const lessonTypeRecord = await prisma.lessonType.findUnique({
      where: { slug: lessonType },
      include: { pricingTiers: { orderBy: { duration: "asc" } } },
    });
    if (!lessonTypeRecord || !lessonTypeRecord.isActive) {
      return NextResponse.json(
        { error: "Invalid lesson type" },
        { status: 400 },
      );
    }

    const billingType = lessonTypeRecord.billingType;
    const allowedDurations = lessonTypeRecord.pricingTiers.map(
      (t) => t.duration,
    );
    const defaultDuration =
      allowedDurations.length > 0 ? allowedDurations[0] : 1.5;
    const lessonDuration = duration || defaultDuration;

    if (billingType === "per_session" && allowedDurations.length > 0) {
      if (!allowedDurations.includes(lessonDuration)) {
        return NextResponse.json(
          {
            error: `Invalid duration for ${lessonTypeRecord.name}. Allowed: ${allowedDurations.join(", ")} hours`,
          },
          { status: 400 },
        );
      }
    }

    if (studentIds && studentIds.length > lessonTypeRecord.maxStudents) {
      return NextResponse.json(
        {
          error: `${lessonTypeRecord.name} allows maximum ${lessonTypeRecord.maxStudents} student(s)`,
        },
        { status: 400 },
      );
    }

    if (teacherId) {
      const teacher = await prisma.teacher.findUnique({
        where: { id: teacherId },
      });
      if (!teacher) {
        return NextResponse.json(
          { error: "Teacher not found" },
          { status: 400 },
        );
      }
      if (!teacher.isActive) {
        return NextResponse.json(
          { error: "Teacher is not active" },
          { status: 400 },
        );
      }
    }

    const [hours, minutes] = startTime.split(":").map(Number);
    const durationMinutes = lessonDuration * 60;
    const endMinutes = minutes + durationMinutes;
    const endHours = hours + Math.floor(endMinutes / 60);
    const endTime = `${endHours.toString().padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;

    const lessonDateObj = new Date(lessonDate);
    const dayOfWeek = lessonDateObj.getDay();

    const conflictingBookings = await prisma.booking.findFirst({
      where: {
        courtId,
        bookingDate: lessonDateObj,
        status: { in: ["pending", "confirmed"] },
        OR: [
          {
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        ],
      },
    });

    if (conflictingBookings) {
      return NextResponse.json(
        { error: "This time slot conflicts with an existing booking" },
        { status: 409 },
      );
    }

    const timeSlots = await prisma.timeSlot.findMany({
      orderBy: { slotTime: "asc" },
    });
    const allSlotTimes = timeSlots.map((s) => s.slotTime);
    const startIdx = allSlotTimes.indexOf(startTime);
    const endIdx = allSlotTimes.indexOf(endTime);
    const lessonSlots =
      startIdx !== -1 && endIdx !== -1
        ? allSlotTimes.slice(startIdx, endIdx)
        : [startTime];

    const conflictingRecurring = await prisma.recurringBooking.findFirst({
      where: {
        courtId,
        dayOfWeek,
        startTime: { in: lessonSlots },
        isActive: true,
        startDate: { lte: lessonDateObj },
        OR: [{ endDate: null }, { endDate: { gte: lessonDateObj } }],
      },
    });

    if (conflictingRecurring) {
      return NextResponse.json(
        { error: "This time slot conflicts with a recurring booking" },
        { status: 409 },
      );
    }

    const conflictingLessons = await prisma.lessonSession.findFirst({
      where: {
        courtId,
        lessonDate: lessonDateObj,
        status: { in: ["scheduled"] },
        OR: [
          {
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        ],
      },
    });

    if (conflictingLessons) {
      return NextResponse.json(
        { error: "This time slot conflicts with another lesson" },
        { status: 409 },
      );
    }

    const tier = lessonTypeRecord.pricingTiers.find(
      (t) => t.duration === lessonDuration,
    );
    const price = tier ? tier.price : lessonTypeRecord.price;

    const lesson = await prisma.$transaction(async (tx) => {
      const txBookingConflict = await tx.booking.findFirst({
        where: {
          courtId,
          bookingDate: lessonDateObj,
          status: { in: ["pending", "confirmed"] },
          OR: [{ startTime: { lt: endTime }, endTime: { gt: startTime } }],
        },
      });
      if (txBookingConflict) {
        throw new Error("BOOKING_CONFLICT");
      }

      const txLessonConflict = await tx.lessonSession.findFirst({
        where: {
          courtId,
          lessonDate: lessonDateObj,
          status: { in: ["scheduled"] },
          OR: [{ startTime: { lt: endTime }, endTime: { gt: startTime } }],
        },
      });
      if (txLessonConflict) {
        throw new Error("LESSON_CONFLICT");
      }

      return tx.lessonSession.create({
        data: {
          courtId,
          lessonDate: lessonDateObj,
          startTime,
          endTime,
          lessonType,
          billingType,
          duration: lessonDuration,
          price,
          pricePerStudent: pricePerStudent ?? (price / (lessonTypeRecord.maxStudents || 1)),
          isOpenEnrollment: isOpenEnrollment ?? false,
          status: "scheduled",
          notes,
          teacherId: teacherId || null,
          students: ids.length > 0 ? {
            connect: ids.map((id: string) => ({ id })),
          } : undefined,
        },
        include: {
          court: true,
          teacher: { select: { id: true, name: true } },
          students: {
            select: {
              id: true,
              name: true,
              phone: true,
              skillLevel: true,
            },
          },
        },
      });
    });

    return NextResponse.json({ lesson }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "BOOKING_CONFLICT") {
      return NextResponse.json(
        { error: "This time slot conflicts with an existing booking" },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message === "LESSON_CONFLICT") {
      return NextResponse.json(
        { error: "This time slot conflicts with another lesson" },
        { status: 409 },
      );
    }
    console.error("Error creating lesson:", error);
    return NextResponse.json(
      { error: "Failed to create lesson" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || !isAdmin(session.user.email, session.user.isAdmin)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      lessonId,
      status,
      notes,
      teacherId,
      courtId,
      startTime,
      lessonType,
      duration,
      studentIds,
    } = body;

    if (!lessonId) {
      return NextResponse.json(
        { error: "Lesson ID is required" },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    if (teacherId !== undefined) {
      if (teacherId) {
        const teacher = await prisma.teacher.findUnique({
          where: { id: teacherId },
        });
        if (!teacher?.isActive) {
          return NextResponse.json(
            { error: "Teacher not found or inactive" },
            { status: 400 },
          );
        }
      }
      updateData.teacherId = teacherId || null;
    }

    // Full lesson edit fields
    if (courtId !== undefined) updateData.courtId = courtId;

    if (lessonType !== undefined) {
      const lessonTypeRecord = await prisma.lessonType.findUnique({
        where: { slug: lessonType },
        include: { pricingTiers: { orderBy: { duration: "asc" } } },
      });
      if (!lessonTypeRecord || !lessonTypeRecord.isActive) {
        return NextResponse.json(
          { error: "Invalid lesson type" },
          { status: 400 },
        );
      }
      updateData.lessonType = lessonType;
      updateData.billingType = lessonTypeRecord.billingType;

      const lessonDuration = duration ?? lessonTypeRecord.pricingTiers[0]?.duration ?? 1.5;
      updateData.duration = lessonDuration;

      const tier = lessonTypeRecord.pricingTiers.find(
        (t) => t.duration === lessonDuration,
      );
      const price = tier ? tier.price : lessonTypeRecord.price;
      updateData.price = price;
      updateData.pricePerStudent = price / (lessonTypeRecord.maxStudents || 1);

      if (startTime !== undefined) {
        const [hours, minutes] = startTime.split(":").map(Number);
        const durationMinutes = lessonDuration * 60;
        const endMinutes = minutes + durationMinutes;
        const endHours = hours + Math.floor(endMinutes / 60);
        const endTime = `${endHours.toString().padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;
        updateData.startTime = startTime;
        updateData.endTime = endTime;

        // Check for conflicts (excluding this lesson)
        const existing = await prisma.lessonSession.findUnique({
          where: { id: lessonId },
          select: { lessonDate: true, courtId: true },
        });
        if (existing) {
          const checkCourtId = courtId ?? existing.courtId;
          const conflictingLesson = await prisma.lessonSession.findFirst({
            where: {
              id: { not: lessonId },
              courtId: checkCourtId,
              lessonDate: existing.lessonDate,
              status: { in: ["scheduled"] },
              OR: [{ startTime: { lt: endTime }, endTime: { gt: startTime } }],
            },
          });
          if (conflictingLesson) {
            return NextResponse.json(
              { error: "This time slot conflicts with another lesson" },
              { status: 409 },
            );
          }
        }
      }
    } else if (startTime !== undefined || duration !== undefined) {
      // startTime/duration changed without lessonType — recompute endTime
      const existing = await prisma.lessonSession.findUnique({
        where: { id: lessonId },
        select: { startTime: true, duration: true, lessonDate: true, courtId: true },
      });
      if (existing) {
        const resolvedStart = startTime ?? existing.startTime;
        const resolvedDuration = duration ?? existing.duration;
        const [hours, minutes] = resolvedStart.split(":").map(Number);
        const durationMinutes = resolvedDuration * 60;
        const endMinutes = minutes + durationMinutes;
        const endHours = hours + Math.floor(endMinutes / 60);
        const endTime = `${endHours.toString().padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;
        if (startTime !== undefined) updateData.startTime = startTime;
        if (duration !== undefined) updateData.duration = duration;
        updateData.endTime = endTime;

        const checkCourtId = courtId ?? existing.courtId;
        const conflictingLesson = await prisma.lessonSession.findFirst({
          where: {
            id: { not: lessonId },
            courtId: checkCourtId,
            lessonDate: existing.lessonDate,
            status: { in: ["scheduled"] },
            OR: [{ startTime: { lt: endTime }, endTime: { gt: resolvedStart } }],
          },
        });
        if (conflictingLesson) {
          return NextResponse.json(
            { error: "This time slot conflicts with another lesson" },
            { status: 409 },
          );
        }
      }
    }

    const lesson = await prisma.lessonSession.update({
      where: { id: lessonId },
      data: {
        ...updateData,
        ...(studentIds !== undefined && {
          students: { set: studentIds.map((id: string) => ({ id })) },
        }),
      },
      include: {
        court: true,
        teacher: { select: { id: true, name: true } },
        students: {
          select: {
            id: true,
            name: true,
            phone: true,
            skillLevel: true,
          },
        },
        enrollments: {
          select: {
            id: true,
            status: true,
            amountDue: true,
            receiptUrl: true,
            user: { select: { id: true, name: true, phone: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json({ lesson });
  } catch (error) {
    console.error("Error updating lesson:", error);
    return NextResponse.json(
      { error: "Failed to update lesson" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || !isAdmin(session.user.email, session.user.isAdmin)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { lessonId } = body;

    if (!lessonId) {
      return NextResponse.json(
        { error: "Lesson ID is required" },
        { status: 400 },
      );
    }

    const lesson = await prisma.lessonSession.findUnique({
      where: { id: lessonId },
      include: {
        students: { select: { id: true } },
        court: { select: { name: true } },
      },
    });

    await prisma.lessonSession.update({
      where: { id: lessonId },
      data: { status: "cancelled" },
    });

    if (lesson && lesson.students.length > 0) {
      const { notifyLessonCancelled } =
        await import("@/lib/lesson-notifications");
      await notifyLessonCancelled({
        studentIds: lesson.students.map((s) => s.id),
        lessonType: lesson.lessonType,
        lessonDate: format(lesson.lessonDate, "MMM d"),
        startTime: lesson.startTime,
      }).catch((err) => console.error("Notification error:", err));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling lesson:", error);
    return NextResponse.json(
      { error: "Failed to cancel lesson" },
      { status: 500 },
    );
  }
}
