"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CountdownTimer } from "@/components/booking/CountdownTimer";
import { ReceiptUpload } from "@/components/booking/ReceiptUpload";
import { Loader2, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";

function PaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const bookingIds = searchParams.get("ids")?.split(",") || [];
  const paymentMethod = searchParams.get("method") || "tng";
  const expiresAt = searchParams.get("expiresAt") || "";

  const [bookingStatus, setBookingStatus] = useState<
    "pending" | "uploaded" | "verified" | "expired"
  >("pending");
  const [loading, setLoading] = useState(true);

  // Poll for booking status updates
  const pollStatus = useCallback(async () => {
    if (bookingIds.length === 0) return;
    try {
      const res = await fetch("/api/bookings");
      if (!res.ok) return;
      const data = await res.json();
      const relevantBookings = data.bookings?.filter(
        (b: { id: string }) => bookingIds.includes(b.id),
      );

      if (!relevantBookings || relevantBookings.length === 0) return;

      const allPaid = relevantBookings.every(
        (b: { paymentStatus: string }) => b.paymentStatus === "paid",
      );
      const anyExpired = relevantBookings.some(
        (b: { status: string }) => b.status === "expired",
      );
      const anyUploaded = relevantBookings.some(
        (b: { receiptVerificationStatus: string | null }) =>
          b.receiptVerificationStatus === "pending_verification",
      );

      if (allPaid) {
        setBookingStatus("verified");
      } else if (anyExpired) {
        setBookingStatus("expired");
      } else if (anyUploaded) {
        setBookingStatus("uploaded");
      }
    } catch {
      // Ignore polling errors
    }
  }, [bookingIds]);

  useEffect(() => {
    setLoading(false);

    if (bookingStatus === "verified" || bookingStatus === "expired") return;

    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [pollStatus, bookingStatus]);

  const handleUploadSuccess = () => {
    setBookingStatus("uploaded");
    toast.success("Receipt uploaded! Awaiting admin verification.");
  };

  const handleUploadError = (error: string) => {
    toast.error(error);
  };

  const handleExpire = () => {
    setBookingStatus("expired");
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (bookingIds.length === 0) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-8">
        <Card className="bg-card border-border">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No booking found.</p>
            <Button asChild className="mt-4">
              <Link href="/booking">Back to Booking</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-lg px-4 py-8">
      <Button variant="ghost" asChild className="mb-4">
        <Link href="/booking">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Booking
        </Link>
      </Button>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Complete Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Countdown Timer */}
          {bookingStatus === "pending" && expiresAt && (
            <CountdownTimer expiresAt={expiresAt} onExpire={handleExpire} />
          )}

          {/* Status Messages */}
          {bookingStatus === "verified" && (
            <div className="flex items-center gap-3 rounded-lg bg-green-500/10 p-4 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              <div>
                <p className="font-semibold">Payment Verified!</p>
                <p className="text-sm">Your booking has been confirmed.</p>
              </div>
            </div>
          )}

          {bookingStatus === "expired" && (
            <div className="flex items-center gap-3 rounded-lg bg-destructive/10 p-4 text-destructive">
              <XCircle className="h-6 w-6" />
              <div>
                <p className="font-semibold">Booking Expired</p>
                <p className="text-sm">
                  The payment window has expired. Please create a new booking.
                </p>
              </div>
            </div>
          )}

          {bookingStatus === "uploaded" && (
            <div className="flex items-center gap-3 rounded-lg bg-primary/10 p-4 text-primary">
              <CheckCircle2 className="h-6 w-6" />
              <div>
                <p className="font-semibold">Receipt Submitted</p>
                <p className="text-sm">
                  Awaiting admin verification. You will be notified once confirmed.
                </p>
              </div>
            </div>
          )}

          {/* Payment QR Code */}
          {(bookingStatus === "pending" || bookingStatus === "uploaded") && (
            <div className="space-y-4">
              <div className="text-center">
                <Badge variant="secondary" className="mb-3">
                  {paymentMethod === "tng" ? "Touch 'n Go" : "DuitNow"}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Scan the QR code below to make payment
                </p>
              </div>

              <div className="flex justify-center">
                <div className="relative h-64 w-64 overflow-hidden rounded-lg border border-border bg-white p-2">
                  <Image
                    src={
                      paymentMethod === "tng"
                        ? "/images/tng-qr.png"
                        : "/images/duitnow-qr.png"
                    }
                    alt={`${paymentMethod === "tng" ? "Touch 'n Go" : "DuitNow"} QR Code`}
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Receipt Upload */}
          {bookingStatus === "pending" && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">
                Upload Payment Receipt
              </h3>
              <p className="text-xs text-muted-foreground">
                After making payment, upload a screenshot for verification.
              </p>
              <ReceiptUpload
                bookingId={bookingIds[0]}
                onUploadSuccess={handleUploadSuccess}
                onUploadError={handleUploadError}
              />
            </div>
          )}

          {/* Actions */}
          {bookingStatus === "expired" && (
            <Button asChild className="w-full bg-primary text-white hover:bg-primary/90">
              <Link href="/booking">Create New Booking</Link>
            </Button>
          )}
          {bookingStatus === "verified" && (
            <Button asChild className="w-full bg-primary text-white hover:bg-primary/90">
              <Link href="/profile?tab=bookings">View My Bookings</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <PaymentContent />
    </Suspense>
  );
}
