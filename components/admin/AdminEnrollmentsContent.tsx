"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CalendarDays,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Enrollment {
  id: string;
  status: string;
  amountDue: number;
  receiptUrl: string | null;
  adminNotes: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
  };
  lessonSession: {
    id: string;
    lessonDate: string;
    startTime: string;
    endTime: string;
    lessonType: string;
    court: { name: string };
  };
}

export default function AdminEnrollmentsContent() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"PENDING_PAYMENT" | "PAID" | "REJECTED" | "all">("PENDING_PAYMENT");
  const [reviewDialog, setReviewDialog] = useState<Enrollment | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const res = await fetch(`/api/admin/enrollments${params}`);
      if (res.ok) {
        const data = await res.json();
        setEnrollments(data);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const handleReview = async (status: "PAID" | "REJECTED") => {
    if (!reviewDialog) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/enrollments/${reviewDialog.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNotes: reviewNotes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update enrollment");
        return;
      }
      toast.success(
        status === "PAID" ? "Enrollment confirmed" : "Enrollment rejected"
      );
      setReviewDialog(null);
      setReviewNotes("");
      fetchEnrollments();
    } catch {
      toast.error("Failed to update enrollment");
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "PENDING_PAYMENT":
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-400">
            Awaiting Payment
          </Badge>
        );
      case "PAID":
        return <Badge className="bg-green-600 text-white">Confirmed</Badge>;
      case "REJECTED":
        return <Badge variant="destructive">Rejected</Badge>;
      case "CANCELLED":
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["PENDING_PAYMENT", "PAID", "REJECTED", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? "bg-primary text-white"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {f === "PENDING_PAYMENT"
              ? "Pending"
              : f === "all"
              ? "All"
              : f === "PAID"
              ? "Confirmed"
              : "Rejected"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : enrollments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No enrollments found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {enrollments.map((e) => (
            <Card key={e.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1.5">
                    {/* User */}
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {e.user.name || "Unknown"}
                      </span>
                      {statusBadge(e.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {e.user.phone || e.user.email || ""}
                    </p>

                    {/* Lesson details */}
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span>
                          {format(
                            new Date(e.lessonSession.lessonDate),
                            "EEE, d MMM yyyy"
                          )}{" "}
                          · {e.lessonSession.startTime}–{e.lessonSession.endTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {e.lessonSession.lessonType} ·{" "}
                          {e.lessonSession.court.name}
                        </span>
                      </div>
                    </div>

                    {e.adminNotes && (
                      <p className="text-xs text-muted-foreground italic">
                        Note: {e.adminNotes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="font-bold text-foreground text-lg">
                      RM{e.amountDue.toFixed(2)}
                    </span>

                    {e.receiptUrl && (
                      <a
                        href={e.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Receipt
                      </a>
                    )}

                    {e.status === "PENDING_PAYMENT" && (
                      <Button
                        size="sm"
                        variant={e.receiptUrl ? "default" : "outline"}
                        onClick={() => {
                          setReviewDialog(e);
                          setReviewNotes(e.adminNotes || "");
                        }}
                      >
                        {e.receiptUrl ? "Review" : "View"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      {reviewDialog && (
        <Dialog
          open={!!reviewDialog}
          onOpenChange={(o) => !o && setReviewDialog(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Review Enrollment</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-secondary rounded-lg p-3 text-sm">
                <p className="font-medium">{reviewDialog.user.name}</p>
                <p className="text-muted-foreground">
                  {format(
                    new Date(reviewDialog.lessonSession.lessonDate),
                    "EEE, d MMM yyyy"
                  )}{" "}
                  · {reviewDialog.lessonSession.startTime}
                </p>
                <p className="font-bold text-foreground mt-1">
                  RM{reviewDialog.amountDue.toFixed(2)}
                </p>
              </div>

              {reviewDialog.receiptUrl && (
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={reviewDialog.receiptUrl}
                    alt="Payment receipt"
                    className="w-full max-h-64 object-contain rounded-lg border border-border"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-foreground">
                  Notes (optional)
                </label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  placeholder="Add a note for the user..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="destructive"
                disabled={submitting}
                onClick={() => handleReview("REJECTED")}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <XCircle className="w-4 h-4 mr-1" />
                )}
                Reject
              </Button>
              <Button
                disabled={submitting}
                onClick={() => handleReview("PAID")}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                )}
                Confirm Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
