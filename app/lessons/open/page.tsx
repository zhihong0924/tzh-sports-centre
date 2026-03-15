"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  GraduationCap,
  Loader2,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { EnrollmentPaymentDialog } from "@/components/lessons/EnrollmentPaymentDialog";

interface MyEnrollment {
  id: string;
  status: string;
  amountDue: number;
  receiptUrl: string | null;
}

interface OpenLesson {
  id: string;
  lessonDate: string;
  startTime: string;
  endTime: string;
  lessonType: string;
  duration: number;
  price: number;
  pricePerStudent: number | null;
  status: string;
  notes: string | null;
  court: { id: number; name: string };
  teacher: { id: string; name: string } | null;
  directStudentCount: number;
  paidEnrollments: number;
  pendingEnrollments: number;
  myEnrollment: MyEnrollment | null;
}

export default function OpenLessonsPage() {
  const { data: session } = useSession();
  const t = useTranslations("openLessons");
  const [lessons, setLessons] = useState<OpenLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLessonId, setActionLessonId] = useState<string | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<OpenLesson | null>(null);

  const fetchLessons = useCallback(async () => {
    try {
      const res = await fetch("/api/lessons/open");
      if (res.ok) {
        const data = await res.json();
        setLessons(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const handleEnroll = async (lesson: OpenLesson) => {
    if (!session) {
      toast.error(t("loginToJoin"));
      return;
    }

    setActionLessonId(lesson.id);
    try {
      const res = await fetch(`/api/lessons/${lesson.id}/enroll`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("enrollError"));
        return;
      }
      toast.success(t("enrollSuccess"));
      await fetchLessons();
      // Open payment dialog for the newly enrolled lesson
      const updated = await fetch("/api/lessons/open");
      const updatedData: OpenLesson[] = await updated.json();
      const freshLesson = updatedData.find((l) => l.id === lesson.id);
      if (freshLesson?.myEnrollment) {
        setPaymentDialog(freshLesson);
      }
    } catch {
      toast.error(t("enrollError"));
    } finally {
      setActionLessonId(null);
    }
  };

  const handleCancelEnrollment = async (lesson: OpenLesson) => {
    if (
      !confirm(`${t("confirmCancel")}\n${t("confirmCancelDesc")}`)
    ) {
      return;
    }

    setActionLessonId(lesson.id);
    try {
      const res = await fetch(`/api/lessons/${lesson.id}/enroll`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("cancelError"));
        return;
      }
      toast.success(t("cancelSuccess"));
      fetchLessons();
    } catch {
      toast.error(t("cancelError"));
    } finally {
      setActionLessonId(null);
    }
  };

  const getEnrollmentBadge = (status: string) => {
    switch (status) {
      case "PENDING_PAYMENT":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-400">{t("pending")}</Badge>;
      case "PAID":
        return <Badge className="bg-green-600 text-white">{t("paid")}</Badge>;
      case "CANCELLED":
        return <Badge variant="secondary">{t("cancelled")}</Badge>;
      case "REJECTED":
        return <Badge variant="destructive">{t("rejected")}</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-primary" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("description")}</p>
      </div>

      {lessons.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{t("noSessions")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {lessons.map((lesson) => {
            const pricePerPerson =
              lesson.pricePerStudent ?? lesson.price;
            const isActioning = actionLessonId === lesson.id;
            const myEnrollment = lesson.myEnrollment;
            const isEnrolled =
              myEnrollment?.status === "PENDING_PAYMENT" ||
              myEnrollment?.status === "PAID";
            const occupiedSpots =
              lesson.directStudentCount +
              lesson.paidEnrollments +
              lesson.pendingEnrollments;

            return (
              <Card key={lesson.id} className="bg-card border-border">
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge variant="secondary" className="text-xs mb-1">
                        {lesson.lessonType}
                      </Badge>
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-medium">
                          {format(new Date(lesson.lessonDate), "EEE, d MMM yyyy")}
                        </span>
                      </div>
                    </div>
                    {myEnrollment && getEnrollmentBadge(myEnrollment.status)}
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {lesson.startTime} – {lesson.endTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{lesson.court.name}</span>
                    </div>
                    {lesson.teacher && (
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>{lesson.teacher.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      <span className="font-medium text-foreground">
                        RM{pricePerPerson.toFixed(2)} / person
                      </span>
                    </div>
                  </div>

                  {lesson.notes && (
                    <p className="text-xs text-muted-foreground italic">
                      {lesson.notes}
                    </p>
                  )}

                  {/* Action row */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground">
                      {occupiedSpots} enrolled
                    </span>

                    <div className="flex items-center gap-2">
                      {/* Already paid — show tick */}
                      {myEnrollment?.status === "PAID" && (
                        <div className="flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          {t("paid")}
                        </div>
                      )}

                      {/* Pending — upload receipt or cancel */}
                      {myEnrollment?.status === "PENDING_PAYMENT" && (
                        <>
                          {myEnrollment.receiptUrl ? (
                            <a
                              href={myEnrollment.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary underline flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {t("viewReceipt")}
                            </a>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPaymentDialog(lesson)}
                            >
                              {t("uploadReceipt")}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={isActioning}
                            onClick={() => handleCancelEnrollment(lesson)}
                          >
                            {isActioning ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              t("cancelEnrollment")
                            )}
                          </Button>
                        </>
                      )}

                      {/* Not enrolled — enroll button */}
                      {!isEnrolled &&
                        myEnrollment?.status !== "PAID" && (
                          <Button
                            size="sm"
                            disabled={isActioning}
                            onClick={() => handleEnroll(lesson)}
                          >
                            {isActioning ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : null}
                            {t("join")}
                          </Button>
                        )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Payment dialog */}
      {paymentDialog && paymentDialog.myEnrollment && (
        <EnrollmentPaymentDialog
          open={!!paymentDialog}
          onOpenChange={(o) => !o && setPaymentDialog(null)}
          enrollmentId={paymentDialog.myEnrollment.id}
          lessonSessionId={paymentDialog.id}
          amountDue={paymentDialog.myEnrollment.amountDue}
          lessonDate={paymentDialog.lessonDate}
          startTime={paymentDialog.startTime}
          endTime={paymentDialog.endTime}
          lessonType={paymentDialog.lessonType}
          courtName={paymentDialog.court.name}
          onSuccess={() => {
            setPaymentDialog(null);
            fetchLessons();
          }}
        />
      )}

      <div className="mt-6 text-center">
        <Link href="/lessons" className="text-sm text-primary underline">
          ← Back to Lessons
        </Link>
      </div>
    </div>
  );
}
