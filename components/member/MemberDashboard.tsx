"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  Loader2,
  Clock,
  CalendarCheck,
  BookOpen,
  Users,
  MessageCircle,
  CalendarX2,
  AlertTriangle,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { startOfDay, isBefore } from "date-fns";

import { WeeklyTimetable } from "./WeeklyTimetable";
import { StatsCards } from "./StatsCards";
import { CoachSuggestedSection } from "./CoachSuggestedSection";
import { PendingRequestsSection } from "./PendingRequestsSection";
import { UpcomingLessonsSection } from "./UpcomingLessonsSection";
import { RequestHistorySection } from "./RequestHistorySection";
import { AbsenceReplacementSection } from "./AbsenceReplacementSection";
import { BookingDialog } from "./BookingDialog";
import { CounterProposeDialog } from "./CounterProposeDialog";

interface Lesson {
  id: string;
  lessonDate: string;
  startTime: string;
  endTime: string;
  lessonType: string;
  duration: number;
  price: number;
  status: string;
  notes: string | null;
  court: { name: string };
  students: { id: string; name: string }[];
}

interface LessonRequest {
  id: string;
  requestedDate: string;
  requestedTime: string;
  lessonType: string;
  requestedDuration: number;
  status: string;
  adminNotes: string | null;
  suggestedTime: string | null;
  createdAt: string;
}

export function MemberDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("member");

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [requests, setRequests] = useState<LessonRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTrainee, setIsTrainee] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [counterDialogOpen, setCounterDialogOpen] = useState(false);
  const [counterInitialDate, setCounterInitialDate] = useState<
    Date | undefined
  >(undefined);
  const [counterInitialTime, setCounterInitialTime] = useState("");
  const [counterRequestId, setCounterRequestId] = useState<string | null>(null);

  const [timetableKey, setTimetableKey] = useState(0);
  const [billing, setBilling] = useState<{
    unpaidAmount: number;
    status: string;
  } | null>(null);
  const [overdueVisible, setOverdueVisible] = useState(true);

  const fetchBillingSummary = useCallback(async () => {
    try {
      const now = new Date();
      const res = await fetch(
        `/api/profile/billing?summary=true&month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
      );
      if (res.ok) setBilling(await res.json());
    } catch {
      /* billing card shows neutral state on error */
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/member/requests");
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
    }
  }, []);

  const checkTraineeStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/member/lessons");
      if (res.status === 403) {
        setIsTrainee(false);
        setLoading(false);
        return;
      }
      if (res.ok) {
        setIsTrainee(true);
        const data = await res.json();
        setLessons(data.lessons || []);
        fetchRequests();
        fetchBillingSummary();
      }
    } catch (error) {
      console.error("Error checking trainee status:", error);
    } finally {
      setLoading(false);
    }
  }, [fetchRequests, fetchBillingSummary]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.push("/auth/login?callbackUrl=/training");
      return;
    }
    checkTraineeStatus();
  }, [session, status, router, checkTraineeStatus]);

  const refreshData = useCallback(() => {
    checkTraineeStatus();
    setTimetableKey((prev) => prev + 1);
  }, [checkTraineeStatus]);

  const handleSlotSelect = (date: Date, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setBookingDialogOpen(true);
  };

  const handleBookingSubmit = async (data: {
    requestedDate: string;
    requestedTime: string;
    lessonType: string;
    requestedDuration: number;
  }): Promise<boolean> => {
    try {
      const res = await fetch("/api/member/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        refreshData();
        return true;
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to submit request");
        return false;
      }
    } catch (error) {
      console.error("Error submitting request:", error);
      alert("Failed to submit request");
      return false;
    }
  };

  const cancelRequest = async (requestId: string) => {
    if (!confirm(t("cancelConfirm"))) return;

    try {
      const res = await fetch("/api/member/requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });

      if (res.ok) {
        refreshData();
      }
    } catch (error) {
      console.error("Error cancelling request:", error);
    }
  };

  const acceptSuggestedTime = async (requestId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/member/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: "accept" }),
      });

      if (res.ok) {
        refreshData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to accept time");
      }
    } catch (error) {
      console.error("Error accepting time:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const counterProposeTime = (requestId: string) => {
    const request = requests.find((r) => r.id === requestId);
    if (request) {
      if (request.suggestedTime) {
        const [datePart, timePart] = request.suggestedTime.split(" ");
        setCounterInitialDate(new Date(datePart));
        setCounterInitialTime(timePart || "");
      } else {
        setCounterInitialDate(new Date(request.requestedDate));
        setCounterInitialTime(request.requestedTime);
      }
    } else {
      setCounterInitialDate(new Date());
      setCounterInitialTime("");
    }
    setCounterRequestId(requestId);
    setCounterDialogOpen(true);
  };

  const submitCounterProposal = async (newDateTime: string) => {
    if (!counterRequestId) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/member/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: counterRequestId,
          action: "counter",
          newTime: newDateTime,
        }),
      });

      if (res.ok) {
        setCounterDialogOpen(false);
        refreshData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to suggest new time");
      }
    } catch (error) {
      console.error("Error suggesting time:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const today = startOfDay(new Date());
  const upcomingLessons = lessons.filter(
    (l) => !isBefore(new Date(l.lessonDate), today) && l.status === "scheduled",
  );
  const pastLessons = lessons.filter(
    (l) => isBefore(new Date(l.lessonDate), today) || l.status !== "scheduled",
  );
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const suggestedRequests = requests.filter((r) => r.status === "changed");
  const completedCount = pastLessons.filter(
    (l) => l.status === "completed",
  ).length;

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isTrainee !== true) {
    const benefits = [
      {
        icon: CalendarCheck,
        title: t("membersOnly.benefits.scheduling.title"),
        desc: t("membersOnly.benefits.scheduling.desc"),
      },
      {
        icon: BookOpen,
        title: t("membersOnly.benefits.lessons.title"),
        desc: t("membersOnly.benefits.lessons.desc"),
      },
      {
        icon: Users,
        title: t("membersOnly.benefits.timetable.title"),
        desc: t("membersOnly.benefits.timetable.desc"),
      },
      {
        icon: Clock,
        title: t("membersOnly.benefits.recurring.title"),
        desc: t("membersOnly.benefits.recurring.desc"),
      },
    ];

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">
            {t("membersOnly.title")}
          </h2>
          <p className="text-muted-foreground">
            {t("membersOnly.description")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {benefits.map((benefit, i) => (
            <Card key={i} className="border border-border rounded-2xl">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                  <benefit.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">
                    {benefit.title}
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    {benefit.desc}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center space-y-3">
          <a
            href="https://wa.me/60117575508?text=Hi%2C%20I%27m%20interested%20in%20becoming%20a%20training%20member"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-foreground hover:bg-foreground/90 text-white px-6 py-3 rounded-full font-semibold transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            {t("membersOnly.enquire")}
          </a>
          <div>
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="mt-2 rounded-full"
            >
              {t("membersOnly.backToHome")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {t("title")}
            </h1>
            <p className="text-muted-foreground">
              {t("welcome", { name: session?.user?.name || "" })}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="rounded-full gap-2"
          onClick={() => router.push("/profile?tab=absences")}
        >
          <CalendarX2 className="w-4 h-4" />
          {t("absenceManagement.viewAll")}
        </Button>
      </div>

      {overdueVisible &&
        billing &&
        billing.status !== "paid" &&
        new Date().getDate() > 3 && (
          <div className="mb-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-red-800 dark:text-red-200">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Your recurring booking payment of{" "}
                <strong>RM{billing.unpaidAmount.toFixed(2)}</strong> was due on
                the 3rd.{" "}
                <a
                  href="/profile?tab=billing"
                  className="underline font-medium"
                >
                  Pay now →
                </a>
              </span>
            </div>
            <button
              onClick={() => setOverdueVisible(false)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded"
            >
              <X className="w-4 h-4 text-red-600" />
            </button>
          </div>
        )}

      <StatsCards
        upcomingCount={upcomingLessons.length}
        pendingCount={pendingRequests.length}
        completedCount={completedCount}
        billing={billing}
      />

      <div className="mb-6">
        <WeeklyTimetable
          key={timetableKey}
          onSlotSelect={handleSlotSelect}
          onAcceptSuggestion={acceptSuggestedTime}
          onCounterSuggestion={counterProposeTime}
        />
      </div>

      {suggestedRequests.length > 0 && (
        <CoachSuggestedSection
          requests={suggestedRequests}
          onAccept={acceptSuggestedTime}
          onCounterPropose={counterProposeTime}
          submitting={submitting}
        />
      )}

      <PendingRequestsSection
        requests={pendingRequests}
        onCancel={cancelRequest}
      />

      <UpcomingLessonsSection
        lessons={upcomingLessons}
        currentUserName={session?.user?.name}
      />

      <AbsenceReplacementSection
        upcomingLessons={upcomingLessons}
        onRefresh={refreshData}
      />

      <RequestHistorySection requests={requests} />

      <BookingDialog
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        onSubmit={handleBookingSubmit}
      />

      <CounterProposeDialog
        open={counterDialogOpen}
        onOpenChange={setCounterDialogOpen}
        initialDate={counterInitialDate}
        initialTime={counterInitialTime}
        onSubmit={submitCounterProposal}
        submitting={submitting}
      />
    </div>
  );
}
