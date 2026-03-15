import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import {
  sendEmail,
  getBookingExpirationWarningEmail,
  getBookingExpiredEmail,
} from "@/lib/email";

// Constants for expiration rules
const STANDARD_EXPIRATION_HOURS = 48; // 48 hours from creation for bookings > 48 hours away
const SHORT_WINDOW_HOURS_BEFORE = 12; // Must be confirmed 12 hours before booking time
const WARNING_HOURS_BEFORE = 24; // Send warning 24 hours before expiration
export const PAYMENT_WINDOW_MINUTES = 15; // 15 minutes to upload receipt after booking

/**
 * Calculate the payment deadline for a new booking (15 minutes from creation)
 */
export function calculatePaymentDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + PAYMENT_WINDOW_MINUTES * 60 * 1000);
}

export interface ExpirationCheckResult {
  expired: string[];
  warnings: string[];
  errors: string[];
}

/**
 * Calculate the expiration time for a booking
 */
export function calculateExpirationTime(
  createdAt: Date,
  bookingDateTime: Date,
): Date {
  const now = new Date();
  const hoursUntilBooking =
    (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilBooking <= STANDARD_EXPIRATION_HOURS) {
    // Booking is within 48 hours - must be confirmed 12 hours before
    return new Date(
      bookingDateTime.getTime() - SHORT_WINDOW_HOURS_BEFORE * 60 * 60 * 1000,
    );
  } else {
    // Standard rule - 48 hours from creation
    return new Date(
      createdAt.getTime() + STANDARD_EXPIRATION_HOURS * 60 * 60 * 1000,
    );
  }
}

/**
 * Check and process expired bookings
 * Can be called from cron job or on-demand
 */
export async function checkAndExpireBookings(
  options: { sendEmails?: boolean; bookingIds?: string[] } = {},
): Promise<ExpirationCheckResult> {
  const { sendEmails = true, bookingIds } = options;
  const now = new Date();
  const results: ExpirationCheckResult = {
    expired: [],
    warnings: [],
    errors: [],
  };

  // Build query - include both 'pending' bookings AND 'confirmed' bookings
  // with pending payment (TNG/DuitNow that were never paid)
  // Never expire bookings marked as paymentExempt (admin-created, admin-approved)
  const whereClause: Record<string, unknown> = {
    paymentExempt: false,
    OR: [
      // Bookings with explicit 15-min expiresAt that have passed
      { status: "pending", expiredAt: null, expiresAt: { not: null, lte: now } },
      // Legacy bookings without expiresAt (use original 48hr/12hr logic)
      { status: "pending", expiredAt: null, expiresAt: null },
      { status: "confirmed", paymentStatus: "pending", expiredAt: null },
    ],
  };

  if (bookingIds && bookingIds.length > 0) {
    whereClause.id = { in: bookingIds };
  }

  // Get pending bookings
  const pendingBookings = await prisma.booking.findMany({
    where: whereClause,
    include: {
      user: true,
      court: true,
    },
  });

  for (const booking of pendingBookings) {
    try {
      const createdAt = new Date(booking.createdAt);
      const bookingDateTime = new Date(booking.bookingDate);
      const [hours, minutes] = booking.startTime.split(":").map(Number);
      bookingDateTime.setHours(hours, minutes, 0, 0);

      // Use expiresAt if set (15-min payment window), otherwise fall back to legacy logic
      const expirationTime = (booking as Record<string, unknown>).expiresAt
        ? new Date((booking as Record<string, unknown>).expiresAt as string)
        : calculateExpirationTime(createdAt, bookingDateTime);
      const hoursUntilExpiration =
        (expirationTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Check if booking should expire
      if (now >= expirationTime) {
        // Mark as expired
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: "expired",
            expiredAt: now,
          },
        });

        const bookingDate = format(booking.bookingDate, "EEEE, dd MMM yyyy");
        const bookingTime = `${booking.startTime} - ${booking.endTime}`;

        // Send email notification
        if (sendEmails) {
          const userEmail = booking.user?.email || booking.guestEmail;
          const userName =
            booking.user?.name || booking.guestName || "Customer";

          if (userEmail) {
            const emailTemplate = getBookingExpiredEmail({
              userName,
              bookingDate,
              bookingTime,
              courtName: booking.court.name,
            });

            await sendEmail({
              to: userEmail,
              subject: emailTemplate.subject,
              html: emailTemplate.html,
            });
          }
        }

        // Create in-app notification for registered users
        if (booking.userId) {
          await prisma.notification.create({
            data: {
              userId: booking.userId,
              type: "booking_expired",
              title: "Booking Expired",
              message: `Your booking for ${booking.court.name} on ${bookingDate} at ${booking.startTime} has expired as it was not confirmed in time.`,
              link: "/profile",
            },
          });
        }

        // Audit log the expiration
        await prisma.auditLog
          .create({
            data: {
              adminId: "system",
              adminEmail: "cron@system",
              action: "booking_auto_expired",
              targetType: "booking",
              targetId: booking.id,
              details: {
                bookingDate: format(booking.bookingDate, "yyyy-MM-dd"),
                startTime: booking.startTime,
                endTime: booking.endTime,
                courtName: booking.court.name,
                userName: booking.user?.name || booking.guestName || "guest",
                reason: "Payment not confirmed before expiration deadline",
              },
            },
          })
          .catch(() => {});

        results.expired.push(booking.id);
      }
      // Check if we should send warning
      else if (
        hoursUntilExpiration <= WARNING_HOURS_BEFORE &&
        hoursUntilExpiration > 0 &&
        !booking.expirationWarningSent
      ) {
        const bookingDate = format(booking.bookingDate, "EEEE, dd MMM yyyy");
        const bookingTime = `${booking.startTime} - ${booking.endTime}`;

        // Send email notification
        if (sendEmails) {
          const userEmail = booking.user?.email || booking.guestEmail;
          const userName =
            booking.user?.name || booking.guestName || "Customer";

          if (userEmail) {
            const emailTemplate = getBookingExpirationWarningEmail({
              userName,
              bookingDate,
              bookingTime,
              courtName: booking.court.name,
              hoursRemaining: Math.ceil(hoursUntilExpiration),
            });

            await sendEmail({
              to: userEmail,
              subject: emailTemplate.subject,
              html: emailTemplate.html,
            });
          }
        }

        // Create in-app notification for registered users
        if (booking.userId) {
          await prisma.notification.create({
            data: {
              userId: booking.userId,
              type: "booking_warning",
              title: "Booking Confirmation Pending",
              message: `Your booking for ${booking.court.name} on ${bookingDate} at ${booking.startTime} will expire in ${Math.ceil(hoursUntilExpiration)} hours if not confirmed.`,
              link: "/profile",
            },
          });
        }

        // Mark warning as sent
        await prisma.booking.update({
          where: { id: booking.id },
          data: { expirationWarningSent: true },
        });

        results.warnings.push(booking.id);
      }
    } catch (error) {
      console.error(`Error processing booking ${booking.id}:`, error);
      results.errors.push(booking.id);
    }
  }

  return results;
}

/**
 * Get expiration info for a specific booking
 */
export function getBookingExpirationInfo(booking: {
  createdAt: Date;
  bookingDate: Date;
  startTime: string;
  status: string;
  expiredAt: Date | null;
  expiresAt?: Date | null;
}): {
  expirationTime: Date;
  hoursRemaining: number;
  minutesRemaining: number;
  isExpired: boolean;
  willExpireSoon: boolean;
} {
  const now = new Date();
  const createdAt = new Date(booking.createdAt);
  const bookingDateTime = new Date(booking.bookingDate);
  const [hours, minutes] = booking.startTime.split(":").map(Number);
  bookingDateTime.setHours(hours, minutes, 0, 0);

  // Use expiresAt if set (15-min payment window), otherwise legacy logic
  const expirationTime = booking.expiresAt
    ? new Date(booking.expiresAt)
    : calculateExpirationTime(createdAt, bookingDateTime);
  const hoursRemaining =
    (expirationTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  const minutesRemaining =
    (expirationTime.getTime() - now.getTime()) / (1000 * 60);

  return {
    expirationTime,
    hoursRemaining: Math.max(0, hoursRemaining),
    minutesRemaining: Math.max(0, minutesRemaining),
    isExpired:
      booking.status === "expired" ||
      booking.expiredAt !== null ||
      now >= expirationTime,
    willExpireSoon:
      booking.expiresAt
        ? minutesRemaining <= 5 && minutesRemaining > 0
        : hoursRemaining <= WARNING_HOURS_BEFORE && hoursRemaining > 0,
  };
}
