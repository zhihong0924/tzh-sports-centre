import { prisma } from "@/lib/prisma";

export type ConflictType = "booking" | "recurring" | "lesson" | "training-group";

export interface ConflictResult {
  type: ConflictType;
  courtId: number;
  startTime: string;
  endTime: string;
  label: string;
}

export interface SlotAvailability {
  time: string;
  courtId: number;
  status: "available" | "booked" | "recurring" | "lesson" | "training-group";
  label?: string;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  if (hours === 0 && minutes === 0) return 24 * 60;
  return hours * 60 + minutes;
}

function timesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

/**
 * Check for conflicts on a specific court, date, and time range.
 * Returns array of conflicts found, or empty array if no conflicts.
 */
export async function checkCourtConflicts(
  courtId: number,
  date: Date,
  startTime: string,
  endTime: string,
  excludeBookingId?: string,
): Promise<ConflictResult[]> {
  const conflicts: ConflictResult[] = [];
  const dayOfWeek = date.getDay();

  const [bookings, recurringBookings, lessonSessions, trainingGroups] =
    await Promise.all([
      prisma.booking.findMany({
        where: {
          courtId,
          bookingDate: date,
          status: { in: ["pending", "confirmed"] },
          ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          guestName: true,
          user: { select: { name: true } },
        },
      }),
      prisma.recurringBooking.findMany({
        where: {
          courtId,
          dayOfWeek,
          isActive: true,
          startDate: { lte: date },
          OR: [{ endDate: null }, { endDate: { gte: date } }],
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          label: true,
          guestName: true,
          user: { select: { name: true } },
        },
      }),
      prisma.lessonSession.findMany({
        where: {
          courtId,
          lessonDate: date,
          status: "scheduled",
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          lessonType: true,
          students: { select: { name: true } },
        },
      }),
      prisma.trainingGroup.findMany({
        where: {
          courtId,
          dayOfWeek,
          isActive: true,
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          name: true,
        },
      }),
    ]);

  for (const booking of bookings) {
    if (timesOverlap(startTime, endTime, booking.startTime, booking.endTime)) {
      conflicts.push({
        type: "booking",
        courtId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        label:
          booking.user?.name || booking.guestName || "Booking",
      });
    }
  }

  for (const recurring of recurringBookings) {
    if (
      timesOverlap(startTime, endTime, recurring.startTime, recurring.endTime)
    ) {
      conflicts.push({
        type: "recurring",
        courtId,
        startTime: recurring.startTime,
        endTime: recurring.endTime,
        label:
          recurring.label ||
          recurring.user?.name ||
          recurring.guestName ||
          "Recurring Booking",
      });
    }
  }

  for (const lesson of lessonSessions) {
    if (timesOverlap(startTime, endTime, lesson.startTime, lesson.endTime)) {
      conflicts.push({
        type: "lesson",
        courtId,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        label: `Lesson: ${lesson.lessonType}`,
      });
    }
  }

  for (const group of trainingGroups) {
    if (timesOverlap(startTime, endTime, group.startTime, group.endTime)) {
      conflicts.push({
        type: "training-group",
        courtId,
        startTime: group.startTime,
        endTime: group.endTime,
        label: `Training: ${group.name}`,
      });
    }
  }

  return conflicts;
}

/**
 * Get all blocked slots for a specific court and date.
 * Returns a map of slotTime -> SlotAvailability for the entire day.
 */
export async function getBlockedSlots(
  courtId: number,
  date: Date,
): Promise<SlotAvailability[]> {
  const dayOfWeek = date.getDay();
  const blocked: SlotAvailability[] = [];

  const [bookings, recurringBookings, lessonSessions, trainingGroups] =
    await Promise.all([
      prisma.booking.findMany({
        where: {
          courtId,
          bookingDate: date,
          status: { in: ["pending", "confirmed"] },
        },
        select: { startTime: true, endTime: true },
      }),
      prisma.recurringBooking.findMany({
        where: {
          courtId,
          dayOfWeek,
          isActive: true,
          startDate: { lte: date },
          OR: [{ endDate: null }, { endDate: { gte: date } }],
        },
        select: { startTime: true, endTime: true },
      }),
      prisma.lessonSession.findMany({
        where: {
          courtId,
          lessonDate: date,
          status: "scheduled",
        },
        select: { startTime: true, endTime: true, lessonType: true },
      }),
      prisma.trainingGroup.findMany({
        where: {
          courtId,
          dayOfWeek,
          isActive: true,
        },
        select: { startTime: true, endTime: true, name: true },
      }),
    ]);

  // Generate 30-min slots from 09:00 to 23:30
  for (let hour = 9; hour <= 23; hour++) {
    for (const min of [0, 30]) {
      const slotTime = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
      const slotEnd = min === 30
        ? `${(hour + 1).toString().padStart(2, "0")}:00`
        : `${hour.toString().padStart(2, "0")}:30`;

      let status: SlotAvailability["status"] = "available";
      let label: string | undefined;

      for (const b of bookings) {
        if (timesOverlap(slotTime, slotEnd, b.startTime, b.endTime)) {
          status = "booked";
          label = "Booked";
          break;
        }
      }
      if (status === "available") {
        for (const r of recurringBookings) {
          if (timesOverlap(slotTime, slotEnd, r.startTime, r.endTime)) {
            status = "recurring";
            label = "Recurring Booking";
            break;
          }
        }
      }
      if (status === "available") {
        for (const l of lessonSessions) {
          if (timesOverlap(slotTime, slotEnd, l.startTime, l.endTime)) {
            status = "lesson";
            label = `Lesson`;
            break;
          }
        }
      }
      if (status === "available") {
        for (const g of trainingGroups) {
          if (timesOverlap(slotTime, slotEnd, g.startTime, g.endTime)) {
            status = "training-group";
            label = `Training: ${g.name}`;
            break;
          }
        }
      }

      blocked.push({ time: slotTime, courtId, status, label });
    }
  }

  return blocked;
}
