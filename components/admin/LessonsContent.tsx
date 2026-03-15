"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { format, startOfDay, isBefore } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GraduationCap,
  Clock,
  Loader2,
  Plus,
  Trash2,
  RefreshCw,
  CalendarDays,
  Users,
  DollarSign,
  Check,
  LayoutGrid,
  List,
  Repeat,
  CheckSquare,
  Square,
  Pencil,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useTranslations } from "next-intl";
import TrialRequestsContent from "@/components/admin/TrialRequestsContent";
import AttendanceDialog from "@/components/admin/AttendanceDialog";
import RecurringLessonsPanel from "@/components/admin/RecurringLessonsPanel";
import { useLessonTypes } from "@/lib/hooks/useLessonTypes";

const DAYS_OF_WEEK_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const TIME_SLOTS = Array.from({ length: 29 }, (_, i) => {
  const hour = Math.floor(i / 2) + 9;
  const minutes = i % 2 === 0 ? "00" : "30";
  const slotTime = `${hour.toString().padStart(2, "0")}:${minutes}`;
  const ampm = hour < 12 ? "AM" : "PM";
  const displayHour = hour <= 12 ? hour : hour - 12;
  return { slotTime, displayName: `${displayHour}:${minutes} ${ampm}` };
});

const formatTimeRange = (displayName: string): string => {
  const match = displayName.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return displayName;

  const hour = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();

  let endMinutes = minutes + 30;
  let endHour = hour;
  let endPeriod = period;

  if (endMinutes >= 60) {
    endMinutes = 0;
    endHour = hour + 1;
    if (hour === 11 && period === "AM") {
      endPeriod = "PM";
    } else if (hour === 11 && period === "PM") {
      endPeriod = "AM";
    } else if (hour === 12) {
      endHour = 1;
    }
  }

  const startStr = `${hour}:${minutes.toString().padStart(2, "0")}`;
  const endStr = `${endHour}:${endMinutes.toString().padStart(2, "0")}`;
  return `${startStr} - ${endStr} ${endPeriod}`;
};

interface CoachAvailability {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
}

interface Member {
  id: string;
  uid: string;
  name: string;
  phone: string;
  skillLevel: string | null;
}

interface TrainingGroup {
  id: string;
  name: string;
  sport: string;
  members: { id: string }[];
}

interface Court {
  id: number;
  name: string;
}

interface LessonAttendance {
  id?: string;
  userId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  user?: { id: string; name: string };
}

interface LessonEnrollmentSummary {
  id: string;
  status: string;
  amountDue: number;
  receiptUrl: string | null;
  user: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
  };
}

interface LessonSession {
  id: string;
  courtId: number;
  lessonDate: string;
  startTime: string;
  endTime: string;
  lessonType: string;
  billingType?: string;
  duration: number;
  price: number;
  status: string;
  notes: string | null;
  isOpenEnrollment?: boolean;
  court: Court;
  teacher?: { id: string; name: string } | null;
  students: Member[];
  enrollments?: LessonEnrollmentSummary[];
  attendances?: LessonAttendance[];
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
  member: {
    id: string;
    name: string;
    email: string;
    phone: string;
    skillLevel: string | null;
  };
}

interface BookingSlot {
  courtId: number;
  startTime: string;
  guestName?: string;
  userName?: string;
  isRecurring?: boolean;
  recurringLabel?: string;
}

interface LessonsContentProps {
  initialTab?: "schedule" | "availability" | "billing" | "requests";
}

export default function LessonsContent({
  initialTab = "schedule",
}: LessonsContentProps) {
  const { data: session, status } = useSession();
  const t = useTranslations("admin.lessonManagement");
  const tAdmin = useTranslations("admin");
  const tDays = useTranslations("days");

  const DAYS_OF_WEEK = DAYS_OF_WEEK_KEYS.map((key) => tDays(key));

  const {
    lessonTypes: LESSON_TYPES,
    getLessonTypeBySlug,
    getLessonPrice,
    getDefaultDuration,
    isMonthlyBilling,
    getDurationOptions,
    getPricePerPerson,
  } = useLessonTypes();

  const getLessonType = getLessonTypeBySlug;

  const getLessonTypeInfo = (slug: string) => getLessonTypeBySlug(slug);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "schedule" | "availability" | "billing" | "requests"
  >(initialTab);

  const [coachAvailability, setCoachAvailability] = useState<
    CoachAvailability[]
  >([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [lessons, setLessons] = useState<LessonSession[]>([]);
  const [lessonRequests, setLessonRequests] = useState<LessonRequest[]>([]);
  const [bookedSlots, setBookedSlots] = useState<BookingSlot[]>([]);

  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [billingMonth, setBillingMonth] = useState(
    format(new Date(), "yyyy-MM"),
  );

  const [pendingEditLessonId, setPendingEditLessonId] = useState<string | null>(null);

  // Initialize date and pendingEditLessonId from URL params (e.g. when navigating from court bookings tab)
  useEffect(() => {
    const dateParam = searchParams.get("date");
    const editLessonParam = searchParams.get("editLesson");
    if (dateParam) {
      const d = new Date(dateParam + "T12:00:00");
      if (!isNaN(d.getTime())) {
        setSelectedDate(d);
      }
    }
    if (editLessonParam) {
      setPendingEditLessonId(editLessonParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [attendanceLessonId, setAttendanceLessonId] = useState<string | null>(
    null,
  );
  const [attendanceLessonLabel, setAttendanceLessonLabel] = useState("");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [requestDetailsDialogOpen, setRequestDetailsDialogOpen] =
    useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LessonRequest | null>(
    null,
  );
  const [approveCourtId, setApproveCourtId] = useState<number | null>(null);
  const [courtAvailability, setCourtAvailability] = useState<
    Record<number, boolean>
  >({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const [availDays, setAvailDays] = useState<number[]>([]);
  const [availStartTime, setAvailStartTime] = useState("");
  const [availEndTime, setAvailEndTime] = useState("");

  const [availSelectMode, setAvailSelectMode] = useState(false);
  const [selectedAvailIds, setSelectedAvailIds] = useState<string[]>([]);

  const [editAvailDialogOpen, setEditAvailDialogOpen] = useState(false);
  const [editingAvail, setEditingAvail] = useState<CoachAvailability | null>(
    null,
  );
  const [editAvailDay, setEditAvailDay] = useState<number>(0);
  const [editAvailStartTime, setEditAvailStartTime] = useState("");
  const [editAvailEndTime, setEditAvailEndTime] = useState("");

  const [suggestTimeDialogOpen, setSuggestTimeDialogOpen] = useState(false);
  const [suggestDate, setSuggestDate] = useState<Date | undefined>(undefined);
  const [suggestTime, setSuggestTime] = useState("");
  const [suggestNotes, setSuggestNotes] = useState("");

  const [lessonCourtId, setLessonCourtId] = useState<number | null>(null);
  const [lessonStartTime, setLessonStartTime] = useState("");
  const [lessonType, setLessonType] = useState("");
  const [lessonDuration, setLessonDuration] = useState<number>(1.5);
  const [lessonStudentIds, setLessonStudentIds] = useState<string[]>([]);
  const [lessonNotes, setLessonNotes] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [lessonTeacherId, setLessonTeacherId] = useState<string>("");
  const [activeTeachers, setActiveTeachers] = useState<
    { id: string; name: string }[]
  >([]);
  const [trainingGroups, setTrainingGroups] = useState<TrainingGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // Edit lesson state
  const [editLessonDialogOpen, setEditLessonDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonSession | null>(null);
  const [editLessonType, setEditLessonType] = useState("");
  const [editLessonDuration, setEditLessonDuration] = useState<number>(1.5);
  const [editLessonCourtId, setEditLessonCourtId] = useState<number | null>(null);
  const [editLessonStartTime, setEditLessonStartTime] = useState("");
  const [editLessonTeacherId, setEditLessonTeacherId] = useState<string>("");
  const [editLessonStudentIds, setEditLessonStudentIds] = useState<string[]>([]);
  const [editLessonNotes, setEditLessonNotes] = useState("");
  const [editStudentSearch, setEditStudentSearch] = useState("");

  // Upcoming lessons panel
  const [upcomingLessons, setUpcomingLessons] = useState<LessonSession[]>([]);
  const [upcomingExpanded, setUpcomingExpanded] = useState(false);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);

  const fetchUpcomingLessons = async () => {
    setLoadingUpcoming(true);
    try {
      const res = await fetch("/api/admin/lessons?upcoming=true&limit=30");
      const data = await res.json();
      setUpcomingLessons(data.lessons || []);
    } catch (error) {
      console.error("Error fetching upcoming lessons:", error);
    } finally {
      setLoadingUpcoming(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        availRes,
        membersRes,
        courtsRes,
        lessonsRes,
        requestsRes,
        staffRes,
        groupsRes,
      ] = await Promise.all([
        fetch("/api/admin/coach-availability"),
        fetch("/api/admin/members"),
        fetch("/api/courts"),
        fetch(`/api/admin/lessons?date=${format(selectedDate, "yyyy-MM-dd")}`),
        fetch("/api/admin/lesson-requests"),
        fetch("/api/admin/staff"),
        fetch("/api/admin/training-groups"),
      ]);

      const [
        availData,
        membersData,
        courtsData,
        lessonsData,
        requestsData,
        staffData,
        groupsData,
      ] = await Promise.all([
        availRes.json(),
        membersRes.json(),
        courtsRes.json(),
        lessonsRes.json(),
        requestsRes.json(),
        staffRes.json(),
        groupsRes.json(),
      ]);

      setCoachAvailability(availData.availability || []);
      setMembers(membersData.members || []);
      setCourts(courtsData.courts || []);
      setLessons(lessonsData.lessons || []);
      setLessonRequests(requestsData.requests || []);
      setActiveTeachers(
        (staffData.teachers || []).map((t: { id: string; name: string }) => ({
          id: t.id,
          name: t.name,
        })),
      );
      setTrainingGroups(groupsData.groups || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/admin/lesson-requests");
      const data = await res.json();
      setLessonRequests(data.requests || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
    }
  };

  const handleRequestAction = async (
    requestId: string,
    status: string,
    adminNotes?: string,
    suggestedTime?: string,
    courtId?: number,
  ) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/lesson-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          status,
          adminNotes,
          suggestedTime,
          courtId,
        }),
      });
      if (res.ok) {
        fetchRequests();
        if (status === "approved") {
          fetchLessonsForDate();
        }
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update request");
      }
    } catch (error) {
      console.error("Error updating request:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const openApproveDialog = async (request: LessonRequest) => {
    setSelectedRequest(request);
    setApproveCourtId(null);
    setApproveDialogOpen(true);
    setLoadingAvailability(true);

    try {
      const dateStr = format(new Date(request.requestedDate), "yyyy-MM-dd");
      const res = await fetch(`/api/availability?date=${dateStr}`);
      const data = await res.json();

      const duration = request.requestedDuration || 1.5;
      const slotsNeeded = duration * 2;

      const availability: Record<number, boolean> = {};

      const lessonsRes = await fetch(`/api/admin/lessons?date=${dateStr}`);
      const lessonsData = await lessonsRes.json();
      const existingLessons = lessonsData.lessons || [];

      const [startHours, startMinutes] = request.requestedTime
        .split(":")
        .map(Number);
      const durationMinutes = duration * 60;
      const endTotalMinutes = startHours * 60 + startMinutes + durationMinutes;
      const endHours = Math.floor(endTotalMinutes / 60);
      const endMinutes = endTotalMinutes % 60;
      const requestedEndTime = `${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`;

      if (data.courts) {
        data.courts.forEach((court: { id: number }) => {
          let hasBookingConflict = false;
          const courtAvailData = data.availability?.find(
            (ca: { court: { id: number } }) => ca.court.id === court.id,
          );

          if (courtAvailData) {
            const startIdx = courtAvailData.slots.findIndex(
              (s: { slotTime: string }) => s.slotTime === request.requestedTime,
            );
            if (startIdx !== -1) {
              for (
                let i = 0;
                i < slotsNeeded && startIdx + i < courtAvailData.slots.length;
                i++
              ) {
                if (!courtAvailData.slots[startIdx + i].available) {
                  hasBookingConflict = true;
                  break;
                }
              }
            }
          }

          let hasLessonConflict = false;
          existingLessons.forEach(
            (lesson: {
              courtId: number;
              startTime: string;
              endTime: string;
              status: string;
            }) => {
              if (
                lesson.courtId === court.id &&
                lesson.status === "scheduled"
              ) {
                const lessonStart = lesson.startTime;
                const lessonEnd = lesson.endTime;
                if (
                  request.requestedTime < lessonEnd &&
                  requestedEndTime > lessonStart
                ) {
                  hasLessonConflict = true;
                }
              }
            },
          );

          availability[court.id] = !hasBookingConflict && !hasLessonConflict;
        });
      }

      setCourtAvailability(availability);
    } catch (error) {
      console.error("Error fetching availability:", error);
      const defaultAvail: Record<number, boolean> = {};
      courts.forEach((c) => {
        defaultAvail[c.id] = true;
      });
      setCourtAvailability(defaultAvail);
    } finally {
      setLoadingAvailability(false);
    }
  };

  const handleApproveWithCourt = async () => {
    if (!selectedRequest || !approveCourtId) return;
    await handleRequestAction(
      selectedRequest.id,
      "approved",
      undefined,
      undefined,
      approveCourtId,
    );
    setApproveDialogOpen(false);
    setSelectedRequest(null);
    setApproveCourtId(null);
    setCourtAvailability({});
  };

  const fetchLessonsForDate = async () => {
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const [lessonsRes, bookingsRes] = await Promise.all([
        fetch(`/api/admin/lessons?date=${dateStr}`),
        fetch(`/api/admin/bookings?date=${dateStr}`),
      ]);

      const lessonsData = await lessonsRes.json();
      const bookingsData = await bookingsRes.json();

      setLessons(lessonsData.lessons || []);

      const slots: BookingSlot[] = [];

      if (bookingsData.bookings) {
        bookingsData.bookings.forEach(
          (booking: {
            courtId: number;
            startTime: string;
            guestName?: string;
            user?: { name: string };
          }) => {
            slots.push({
              courtId: booking.courtId,
              startTime: booking.startTime,
              guestName: booking.guestName,
              userName: booking.user?.name,
            });
          },
        );
      }

      if (bookingsData.recurringBookings) {
        bookingsData.recurringBookings.forEach(
          (recurring: {
            courtId: number;
            startTime: string;
            label?: string;
            guestName?: string;
            user?: { name: string };
          }) => {
            slots.push({
              courtId: recurring.courtId,
              startTime: recurring.startTime,
              guestName: recurring.guestName,
              userName: recurring.user?.name,
              isRecurring: true,
              recurringLabel: recurring.label,
            });
          },
        );
      }

      setBookedSlots(slots);
    } catch (error) {
      console.error("Error fetching lessons:", error);
    }
  };

  const fetchBillingData = async () => {
    try {
      const res = await fetch(`/api/admin/lessons?month=${billingMonth}`);
      const data = await res.json();
      setLessons(data.lessons || []);
    } catch (error) {
      console.error("Error fetching billing data:", error);
    }
  };

  const createLessonMap = () => {
    const map: Record<string, LessonSession> = {};
    lessons
      .filter((l) => l.status !== "cancelled")
      .forEach((lesson) => {
        const startIdx = TIME_SLOTS.findIndex(
          (s) => s.slotTime === lesson.startTime,
        );
        const endIdx = TIME_SLOTS.findIndex(
          (s) => s.slotTime === lesson.endTime,
        );
        if (startIdx !== -1) {
          const endIndex = endIdx !== -1 ? endIdx : TIME_SLOTS.length;
          for (let i = startIdx; i < endIndex; i++) {
            const key = `${lesson.courtId}-${TIME_SLOTS[i].slotTime}`;
            map[key] = lesson;
          }
        }
      });
    return map;
  };

  const createBookingMap = () => {
    const map: Record<string, BookingSlot> = {};
    bookedSlots.forEach((slot) => {
      const key = `${slot.courtId}-${slot.startTime}`;
      map[key] = slot;
    });
    return map;
  };

  const lessonMap = createLessonMap();
  const bookingMap = createBookingMap();

  const openAddLessonDialog = (courtId: number, slotTime: string) => {
    setLessonCourtId(courtId);
    setLessonStartTime(slotTime);
    setStudentSearch("");
    setSelectedGroupId("");
    setLessonDialogOpen(true);
  };

  useEffect(() => {
    if (session?.user) {
      fetchData();
    }
  }, [session]);

  useEffect(() => {
    if (activeTab === "schedule") {
      fetchLessonsForDate();
    } else if (activeTab === "billing") {
      fetchBillingData();
    }
  }, [selectedDate, billingMonth, activeTab]);

  const handleAddAvailability = async () => {
    if (availDays.length === 0 || !availStartTime || !availEndTime) {
      alert("Please select days, start time, and end time");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/coach-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daysOfWeek: availDays,
          startTime: availStartTime,
          endTime: availEndTime,
          isRecurring: true,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setAvailabilityDialogOpen(false);
        setAvailDays([]);
        setAvailStartTime("");
        setAvailEndTime("");
        fetchData();
      } else {
        alert(data.error || "Failed to add availability");
      }
    } catch (error) {
      console.error("Error adding availability:", error);
      alert("Failed to add availability. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAvailability = async (id: string) => {
    setActionLoading(true);
    try {
      await fetch("/api/admin/coach-availability", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchData();
    } catch (error) {
      console.error("Error deleting availability:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkDeleteAvailability = async () => {
    if (selectedAvailIds.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to delete ${selectedAvailIds.length} availability slot(s)?`,
      )
    )
      return;

    setActionLoading(true);
    try {
      await Promise.all(
        selectedAvailIds.map((id) =>
          fetch("/api/admin/coach-availability", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          }),
        ),
      );
      setSelectedAvailIds([]);
      setAvailSelectMode(false);
      fetchData();
    } catch (error) {
      console.error("Error bulk deleting availability:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const openEditAvailDialog = (avail: CoachAvailability) => {
    setEditingAvail(avail);
    setEditAvailDay(avail.dayOfWeek);
    setEditAvailStartTime(avail.startTime);
    setEditAvailEndTime(avail.endTime);
    setEditAvailDialogOpen(true);
  };

  const handleEditAvailability = async () => {
    if (!editingAvail || !editAvailStartTime || !editAvailEndTime) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/coach-availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingAvail.id,
          dayOfWeek: editAvailDay,
          startTime: editAvailStartTime,
          endTime: editAvailEndTime,
        }),
      });

      if (res.ok) {
        setEditAvailDialogOpen(false);
        setEditingAvail(null);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update availability");
      }
    } catch (error) {
      console.error("Error updating availability:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleAvailSelection = (id: string) => {
    setSelectedAvailIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const toggleAllAvailSelection = () => {
    if (selectedAvailIds.length === coachAvailability.length) {
      setSelectedAvailIds([]);
    } else {
      setSelectedAvailIds(coachAvailability.map((a) => a.id));
    }
  };

  const handleAddLesson = async () => {
    if (
      !lessonCourtId ||
      !lessonStartTime ||
      !lessonType ||
      lessonStudentIds.length === 0
    )
      return;

    const today = startOfDay(new Date());
    if (isBefore(startOfDay(selectedDate), today)) {
      alert("Cannot schedule a lesson in the past");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId: lessonCourtId,
          lessonDate: format(selectedDate, "yyyy-MM-dd"),
          startTime: lessonStartTime,
          lessonType,
          duration: lessonDuration,
          studentIds: lessonStudentIds,
          notes: lessonNotes || null,
          teacherId:
            lessonTeacherId && lessonTeacherId !== "none"
              ? lessonTeacherId
              : null,
        }),
      });

      if (res.ok) {
        setLessonDialogOpen(false);
        setLessonCourtId(null);
        setLessonStartTime("");
        setLessonType("");
        setLessonDuration(1.5);
        setLessonStudentIds([]);
        setLessonNotes("");
        setLessonTeacherId("");
        fetchLessonsForDate();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create lesson");
      }
    } catch (error) {
      console.error("Error adding lesson:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const openEditLessonDialog = (lesson: LessonSession) => {
    setEditingLesson(lesson);
    setEditLessonType(lesson.lessonType);
    setEditLessonDuration(lesson.duration);
    setEditLessonCourtId(lesson.court.id);
    setEditLessonStartTime(lesson.startTime);
    setEditLessonTeacherId(lesson.teacher?.id || "none");
    setEditLessonStudentIds(lesson.students.map((s) => s.id));
    setEditLessonNotes(lesson.notes || "");
    setEditStudentSearch("");
    setEditLessonDialogOpen(true);
  };

  const handleEditLesson = async () => {
    if (!editingLesson || !editLessonCourtId || !editLessonStartTime || !editLessonType) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/lessons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: editingLesson.id,
          courtId: editLessonCourtId,
          startTime: editLessonStartTime,
          lessonType: editLessonType,
          duration: editLessonDuration,
          studentIds: editLessonStudentIds,
          notes: editLessonNotes || null,
          teacherId: editLessonTeacherId && editLessonTeacherId !== "none" ? editLessonTeacherId : null,
        }),
      });

      if (res.ok) {
        setEditLessonDialogOpen(false);
        setEditingLesson(null);
        fetchLessonsForDate();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update lesson");
      }
    } catch (error) {
      console.error("Error updating lesson:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelLesson = async (lessonId: string) => {
    if (!confirm("Are you sure you want to cancel this lesson?")) return;

    setActionLoading(true);
    try {
      await fetch("/api/admin/lessons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      fetchLessonsForDate();
    } catch (error) {
      console.error("Error cancelling lesson:", error);
    } finally {
      setActionLoading(false);
    }
  };

  // Auto-open edit dialog when navigated here with editLesson URL param
  useEffect(() => {
    if (pendingEditLessonId && lessons.length > 0) {
      const lesson = lessons.find((l) => l.id === pendingEditLessonId);
      if (lesson) {
        openEditLessonDialog(lesson);
        setPendingEditLessonId(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEditLessonId, lessons]);

  const openAttendanceDialog = (lesson: LessonSession) => {
    const typeInfo = getLessonTypeInfo(lesson.lessonType);
    setAttendanceLessonId(lesson.id);
    setAttendanceLessonLabel(
      `${typeInfo?.name || lesson.lessonType} — ${lesson.startTime}-${lesson.endTime} — ${lesson.students.map((s) => s.name).join(", ")}`,
    );
    setAttendanceDialogOpen(true);
  };

  const memberGroupMap = (() => {
    const map: Record<string, string[]> = {};
    trainingGroups.forEach((group) => {
      group.members.forEach((m) => {
        if (!map[m.id]) map[m.id] = [];
        map[m.id].push(group.name);
      });
    });
    return map;
  })();

  const getBillingByMember = () => {
    const billing: Record<
      string,
      {
        member: Member;
        lessons: { lesson: LessonSession; attended: boolean }[];
        total: number;
      }
    > = {};

    lessons
      .filter((l) => l.status === "completed")
      .forEach((lesson) => {
        const isPerSession = lesson.billingType !== "monthly";
        const pricePerStudent = lesson.price / lesson.students.length;
        lesson.students.forEach((student) => {
          if (!billing[student.id]) {
            billing[student.id] = { member: student, lessons: [], total: 0 };
          }
          const attendance = lesson.attendances?.find(
            (a) => a.userId === student.id,
          );
          const attended =
            !attendance ||
            attendance.status === "PRESENT" ||
            attendance.status === "LATE";
          billing[student.id].lessons.push({ lesson, attended });
          if (attended || !isPerSession) {
            billing[student.id].total += pricePerStudent;
          }
        });
      });

    return Object.values(billing).sort((a, b) => b.total - a.total);
  };

  const getPendingRequestsForDate = () => {
    const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
    return lessonRequests.filter((r) => {
      const requestDateStr = format(new Date(r.requestedDate), "yyyy-MM-dd");
      return (
        (r.status === "pending" || r.status === "changed") &&
        requestDateStr === selectedDateStr
      );
    });
  };

  const requestMap: Record<string, LessonRequest> = {};
  const requestSkipSlots = new Set<string>();

  getPendingRequestsForDate().forEach((request) => {
    requestMap[request.requestedTime] = request;

    const slotsCount = Math.round(request.requestedDuration * 2);
    const [startHour, startMin] = request.requestedTime.split(":").map(Number);
    let totalMinutes = startHour * 60 + startMin;

    for (let i = 1; i < slotsCount; i++) {
      totalMinutes += 30;
      const skipHour = Math.floor(totalMinutes / 60);
      const skipMin = totalMinutes % 60;
      const skipTime = `${skipHour.toString().padStart(2, "0")}:${skipMin.toString().padStart(2, "0")}`;
      requestSkipSlots.add(skipTime);
    }
  });

  const openRequestDetailsDialog = (request: LessonRequest) => {
    setSelectedRequest(request);
    setRequestDetailsDialogOpen(true);
  };

  const handleApproveFromDetails = () => {
    setRequestDetailsDialogOpen(false);
    if (selectedRequest) {
      openApproveDialog(selectedRequest);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/70" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Refresh + Tabs row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={activeTab === "schedule" ? "default" : "outline"}
            onClick={() => setActiveTab("schedule")}
          >
            <CalendarDays className="w-4 h-4 mr-2" />
            {t("tabs.schedule")}
          </Button>
          <Button
            variant={activeTab === "availability" ? "default" : "outline"}
            onClick={() => setActiveTab("availability")}
          >
            <Clock className="w-4 h-4 mr-2" />
            {t("tabs.availability")}
          </Button>
          <Button
            variant={activeTab === "billing" ? "default" : "outline"}
            onClick={() => setActiveTab("billing")}
          >
            <DollarSign className="w-4 h-4 mr-2" />
            {t("tabs.billing")}
          </Button>
          <Button
            variant={activeTab === "requests" ? "default" : "outline"}
            onClick={() => setActiveTab("requests")}
          >
            <Users className="w-4 h-4 mr-2" />
            {t("tabs.trialRequests")}
          </Button>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          {tAdmin("refresh")}
        </Button>
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/70" />
        </div>
      ) : (
        <>
          {/* Schedule Tab */}
          {activeTab === "schedule" && (
            <div className="space-y-6">
              {/* Top Section: Date Selection and View Toggle */}
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Date Selection Card */}
                <Card className="lg:w-80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CalendarDays className="w-5 h-5" />
                      {t("scheduled.selectDate")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      className="rounded-md border"
                    />
                  </CardContent>
                </Card>

                {/* Info Card */}
                <Card className="flex-1">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <GraduationCap className="w-5 h-5" />
                        {format(selectedDate, "EEEE, MMMM d, yyyy")}
                        <Badge variant="outline" className="ml-2">
                          {
                            lessons.filter((l) => l.status !== "cancelled")
                              .length
                          }{" "}
                          {t("scheduled.lessons")}
                        </Badge>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {/* View Mode Toggle */}
                        <div className="flex items-center border rounded-lg p-1">
                          <Button
                            variant={viewMode === "grid" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setViewMode("grid")}
                            className="h-8"
                          >
                            <LayoutGrid className="w-4 h-4 mr-1" />
                            Grid
                          </Button>
                          <Button
                            variant={viewMode === "list" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setViewMode("list")}
                            className="h-8"
                          >
                            <List className="w-4 h-4 mr-1" />
                            List
                          </Button>
                        </div>
                        <Button
                          onClick={() => {
                            setLessonCourtId(null);
                            setLessonStartTime("");
                            setStudentSearch("");
                            setLessonDialogOpen(true);
                          }}
                          disabled={members.length === 0}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          {t("scheduled.addLesson")}
                        </Button>
                      </div>
                    </div>
                    {members.length === 0 && (
                      <p className="text-xs text-foreground mt-2">
                        {t("scheduled.addMembersFirst")}
                      </p>
                    )}
                  </CardHeader>
                </Card>
              </div>

              {/* Grid/List View */}
              <Card>
                <CardContent className="pt-6">
                  {viewMode === "grid" ? (
                    /* Grid View */
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-secondary">
                            <th className="p-2 text-left text-sm font-medium text-foreground border-b border-border">
                              Time
                            </th>
                            {courts.map((court) => (
                              <th
                                key={court.id}
                                className="p-2 text-center text-sm font-medium text-foreground border-b border-border min-w-[150px]"
                              >
                                {court.name}
                              </th>
                            ))}
                            <th className="p-2 text-center text-sm font-medium text-foreground border-b border-border min-w-[150px] bg-orange-50">
                              Requests
                              {getPendingRequestsForDate().length > 0 && (
                                <Badge className="ml-2 bg-orange-500 text-white">
                                  {getPendingRequestsForDate().length}
                                </Badge>
                              )}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {TIME_SLOTS.map((slot, idx) => {
                            const lessonStartsHere = lessons.filter(
                              (l) =>
                                l.status !== "cancelled" &&
                                l.startTime === slot.slotTime,
                            );

                            return (
                              <tr
                                key={slot.slotTime}
                                className={idx % 2 === 0 ? "bg-secondary" : ""}
                              >
                                <td className="p-2 text-sm font-medium text-foreground border-b border-border whitespace-nowrap">
                                  {formatTimeRange(slot.displayName)}
                                </td>
                                {courts.map((court) => {
                                  const key = `${court.id}-${slot.slotTime}`;
                                  const lesson = lessonMap[key];
                                  const isLessonStart =
                                    lesson &&
                                    lesson.startTime === slot.slotTime;

                                  if (lesson) {
                                    if (isLessonStart) {
                                      const typeInfo = getLessonTypeInfo(
                                        lesson.lessonType,
                                      );
                                      const slotsCount = Math.round(
                                        lesson.duration * 2,
                                      );
                                      return (
                                        <td
                                          key={court.id}
                                          className="p-1 border-b border-border"
                                          rowSpan={slotsCount}
                                        >
                                          <div
                                            className={`p-2 rounded text-xs h-full ${
                                              lesson.status === "completed"
                                                ? "bg-green-100 border border-green-300"
                                                : "bg-purple-100 border border-purple-300"
                                            }`}
                                          >
                                            <div className="flex items-center gap-1 font-medium flex-wrap">
                                              <GraduationCap className="w-3 h-3 text-purple-700" />
                                              <span className="text-purple-600">
                                                {typeInfo?.name}
                                              </span>
                                              {lesson.status ===
                                                "completed" && (
                                                <Badge className="text-[10px] px-1 py-0 bg-green-100 text-green-700 border-0">
                                                  Done
                                                </Badge>
                                              )}
                                            </div>
                                            <div className="text-muted-foreground mt-1">
                                              <Users className="w-3 h-3 inline mr-1" />
                                              {lesson.isOpenEnrollment
                                                ? lesson.enrollments && lesson.enrollments.length > 0
                                                  ? lesson.enrollments.map((e) => e.user.name || "Unknown").join(", ")
                                                  : "No enrollments yet"
                                                : lesson.students
                                                    .map((s) => s.name)
                                                    .join(", ")}
                                            </div>
                                            <div className="text-muted-foreground mt-1">
                                              <Clock className="w-3 h-3 inline mr-1" />
                                              {lesson.duration}hr • RM
                                              {lesson.price}
                                            </div>
                                            <div className="flex gap-1 mt-2">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-blue-600 hover:text-blue-500 hover:bg-blue-50"
                                                onClick={() =>
                                                  openEditLessonDialog(lesson)
                                                }
                                                disabled={actionLoading}
                                              >
                                                <Pencil className="w-3 h-3" />
                                              </Button>
                                              {lesson.status === "scheduled" && (
                                                <>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 text-green-700 hover:text-green-600 hover:bg-green-100 flex-1"
                                                    onClick={() =>
                                                      openAttendanceDialog(lesson)
                                                    }
                                                    disabled={actionLoading}
                                                  >
                                                    <CheckSquare className="w-3 h-3 mr-1" />
                                                    Attend
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 text-red-600 hover:text-red-500 hover:bg-red-50"
                                                    onClick={() =>
                                                      handleCancelLesson(
                                                        lesson.id,
                                                      )
                                                    }
                                                    disabled={actionLoading}
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </Button>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                      );
                                    }
                                    return null;
                                  } else {
                                    const bookingKey = `${court.id}-${slot.slotTime}`;
                                    const booking = bookingMap[bookingKey];

                                    if (booking) {
                                      return (
                                        <td
                                          key={court.id}
                                          className="p-1 border-b border-border"
                                        >
                                          <div className="w-full h-10 flex items-center justify-center bg-secondary border border-border rounded text-xs text-muted-foreground">
                                            {booking.isRecurring ? (
                                              <span
                                                title={
                                                  booking.recurringLabel ||
                                                  "Recurring booking"
                                                }
                                              >
                                                {booking.recurringLabel ||
                                                  "Recurring"}
                                              </span>
                                            ) : (
                                              <span
                                                title={
                                                  booking.guestName ||
                                                  booking.userName ||
                                                  "Booked"
                                                }
                                              >
                                                Booked
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                      );
                                    }

                                    return (
                                      <td
                                        key={court.id}
                                        className="p-1 border-b border-border"
                                      >
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="w-full h-10 border-dashed text-muted-foreground/70 hover:text-muted-foreground"
                                          onClick={() =>
                                            openAddLessonDialog(
                                              court.id,
                                              slot.slotTime,
                                            )
                                          }
                                          disabled={members.length === 0}
                                        >
                                          <Plus className="w-4 h-4" />
                                        </Button>
                                      </td>
                                    );
                                  }
                                })}
                                {/* Requests column cell */}
                                {(() => {
                                  if (requestSkipSlots.has(slot.slotTime)) {
                                    return null;
                                  }

                                  const request = requestMap[slot.slotTime];
                                  if (request) {
                                    const typeInfo = getLessonTypeInfo(
                                      request.lessonType,
                                    );
                                    const slotsCount = Math.round(
                                      request.requestedDuration * 2,
                                    );
                                    return (
                                      <td
                                        className="p-1 border-b border-border"
                                        rowSpan={slotsCount}
                                      >
                                        <div
                                          className="p-2 rounded text-xs h-full bg-orange-50 border border-orange-300 cursor-pointer hover:bg-orange-100 transition-colors"
                                          onClick={() =>
                                            openRequestDetailsDialog(request)
                                          }
                                        >
                                          <div className="flex items-center gap-1 font-medium flex-wrap">
                                            <Users className="w-3 h-3 text-orange-700" />
                                            <span className="text-orange-600">
                                              {request.member.name}
                                            </span>
                                          </div>
                                          <div className="text-muted-foreground mt-1">
                                            {typeInfo?.name} (
                                            {request.requestedDuration}hr)
                                          </div>
                                          <div className="text-green-700 font-medium mt-1">
                                            RM
                                            {getLessonPrice(
                                              request.lessonType,
                                              request.requestedDuration,
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  }

                                  return (
                                    <td className="p-1 border-b border-border">
                                      <div className="w-full h-10" />
                                    </td>
                                  );
                                })()}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    /* List View */
                    <>
                      {lessons.filter((l) => l.status !== "cancelled")
                        .length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          No lessons scheduled for this date
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {lessons
                            .filter((l) => l.status !== "cancelled")
                            .sort((a, b) =>
                              a.startTime.localeCompare(b.startTime),
                            )
                            .map((lesson) => {
                              const typeInfo = getLessonTypeInfo(
                                lesson.lessonType,
                              );
                              return (
                                <div
                                  key={lesson.id}
                                  className={`p-4 rounded-lg border ${
                                    lesson.status === "completed"
                                      ? "bg-green-50 border-green-300"
                                      : "bg-purple-50 border-purple-300"
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-foreground">
                                          {typeInfo?.name}
                                        </span>
                                        <Badge variant="outline">
                                          {lesson.court.name}
                                        </Badge>
                                        {lesson.status === "completed" && (
                                          <Badge className="bg-green-600">
                                            Completed
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        <Clock className="w-3 h-3 inline mr-1" />
                                        {lesson.startTime} - {lesson.endTime} (
                                        {lesson.duration}hr)
                                      </div>
                                      <div className="text-sm text-muted-foreground mt-1">
                                        <Users className="w-3 h-3 inline mr-1" />
                                        {lesson.isOpenEnrollment
                                          ? lesson.enrollments && lesson.enrollments.length > 0
                                            ? lesson.enrollments.map((e) => `${e.user.name || "Unknown"} (${e.status === "PAID" ? "✓" : e.receiptUrl ? "receipt" : "pending"})`).join(", ")
                                            : "No enrollments yet"
                                          : lesson.students
                                              .map((s) => s.name)
                                              .join(", ")}
                                      </div>
                                      <div className="text-sm font-medium mt-1 text-foreground">
                                        RM{lesson.price} (
                                        {lesson.students.length > 1
                                          ? `RM${(lesson.price / lesson.students.length).toFixed(0)} each`
                                          : "total"}
                                        )
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-blue-600"
                                        onClick={() =>
                                          openEditLessonDialog(lesson)
                                        }
                                        disabled={actionLoading}
                                      >
                                        <Pencil className="w-4 h-4 mr-1" />
                                        Edit
                                      </Button>
                                      {lesson.status === "scheduled" && (
                                        <>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-green-700"
                                            onClick={() =>
                                              openAttendanceDialog(lesson)
                                            }
                                            disabled={actionLoading}
                                          >
                                            <CheckSquare className="w-4 h-4 mr-1" />
                                            Attendance
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-red-600"
                                            onClick={() =>
                                              handleCancelLesson(lesson.id)
                                            }
                                            disabled={actionLoading}
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <RecurringLessonsPanel
                courts={courts}
                members={members}
                teachers={activeTeachers}
              />

              {/* Upcoming Lessons Panel */}
              <Card>
                <CardHeader
                  className="pb-3 cursor-pointer select-none"
                  onClick={() => {
                    const newVal = !upcomingExpanded;
                    setUpcomingExpanded(newVal);
                    if (newVal && upcomingLessons.length === 0) {
                      fetchUpcomingLessons();
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <GraduationCap className="w-5 h-5" />
                      Upcoming Lessons
                      {upcomingLessons.length > 0 && (
                        <Badge variant="outline">{upcomingLessons.length}</Badge>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {upcomingExpanded && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchUpcomingLessons();
                          }}
                          disabled={loadingUpcoming}
                        >
                          <RefreshCw className={`w-4 h-4 ${loadingUpcoming ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                      {upcomingExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                {upcomingExpanded && (
                  <CardContent>
                    {loadingUpcoming ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : upcomingLessons.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No upcoming lessons scheduled
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {upcomingLessons.map((lesson) => {
                          const typeInfo = getLessonTypeInfo(lesson.lessonType);
                          return (
                            <div
                              key={lesson.id}
                              className={`p-4 rounded-lg border ${
                                lesson.status === "completed"
                                  ? "bg-green-50 border-green-300"
                                  : "bg-purple-50 border-purple-300"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="font-medium text-foreground">
                                      {typeInfo?.name || lesson.lessonType}
                                    </span>
                                    <Badge variant="outline">{lesson.court.name}</Badge>
                                    <Badge variant="outline">
                                      {format(new Date(lesson.lessonDate), "d MMM yyyy")}
                                    </Badge>
                                    {lesson.status === "completed" && (
                                      <Badge className="bg-green-600 text-white">Completed</Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    <Clock className="w-3 h-3 inline mr-1" />
                                    {lesson.startTime} – {lesson.endTime} ({lesson.duration}hr)
                                  </div>
                                  <div className="text-sm text-muted-foreground mt-1">
                                    <Users className="w-3 h-3 inline mr-1" />
                                    {lesson.isOpenEnrollment
                                      ? lesson.enrollments && lesson.enrollments.length > 0
                                        ? lesson.enrollments.map((e) => e.user.name || "Unknown").join(", ")
                                        : "No enrollments yet"
                                      : lesson.students.length > 0
                                        ? lesson.students.map((s) => s.name).join(", ")
                                        : "No students"}
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-blue-600 shrink-0"
                                  onClick={() => {
                                    setSelectedDate(new Date(lesson.lessonDate));
                                    openEditLessonDialog(lesson);
                                  }}
                                  disabled={actionLoading}
                                >
                                  <Pencil className="w-4 h-4 mr-1" />
                                  Edit
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            </div>
          )}

          {/* Availability Tab */}
          {activeTab === "availability" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Coach Availability</CardTitle>
                  <div className="flex items-center gap-2">
                    {availSelectMode ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={toggleAllAvailSelection}
                        >
                          {selectedAvailIds.length ===
                          coachAvailability.length ? (
                            <>
                              <CheckSquare className="w-4 h-4 mr-2" />
                              Deselect All
                            </>
                          ) : (
                            <>
                              <Square className="w-4 h-4 mr-2" />
                              Select All
                            </>
                          )}
                        </Button>
                        {selectedAvailIds.length > 0 && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBulkDeleteAvailability}
                            disabled={actionLoading}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete ({selectedAvailIds.length})
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAvailSelectMode(false);
                            setSelectedAvailIds([]);
                          }}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        {coachAvailability.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAvailSelectMode(true)}
                          >
                            <CheckSquare className="w-4 h-4 mr-2" />
                            Select
                          </Button>
                        )}
                        <Button onClick={() => setAvailabilityDialogOpen(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Availability
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {coachAvailability.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No availability set. Add your available times for training.
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {coachAvailability.map((avail) => {
                      const isSelected = selectedAvailIds.includes(avail.id);
                      return (
                        <div
                          key={avail.id}
                          className={`p-4 rounded-lg border transition-all ${
                            availSelectMode
                              ? isSelected
                                ? "bg-primary/30 border-primary ring-2 ring-primary"
                                : "bg-primary/30 border-border hover:border-primary cursor-pointer"
                              : "bg-primary/30 border-border"
                          }`}
                          onClick={() =>
                            availSelectMode && toggleAvailSelection(avail.id)
                          }
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              {availSelectMode && (
                                <div className="pt-1">
                                  {isSelected ? (
                                    <CheckSquare className="w-5 h-5 text-foreground" />
                                  ) : (
                                    <Square className="w-5 h-5 text-muted-foreground/70" />
                                  )}
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-foreground">
                                  {DAYS_OF_WEEK[avail.dayOfWeek]}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {avail.startTime} - {avail.endTime}
                                </div>
                                {avail.isRecurring && (
                                  <Badge variant="outline" className="mt-1">
                                    Weekly
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {!availSelectMode && (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-foreground hover:text-foreground hover:bg-primary/30"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditAvailDialog(avail);
                                  }}
                                  disabled={actionLoading}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-500 hover:bg-red-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAvailability(avail.id);
                                  }}
                                  disabled={actionLoading}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Billing Tab */}
          {activeTab === "billing" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Monthly Billing Summary</CardTitle>
                    <Input
                      type="month"
                      value={billingMonth}
                      onChange={(e) => setBillingMonth(e.target.value)}
                      className="w-48"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {getBillingByMember().length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No completed lessons for this month
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {getBillingByMember().map(
                        ({ member, lessons: memberLessons, total }) => (
                          <div
                            key={member.id}
                            className="p-4 rounded-lg border border-border bg-secondary"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-lg text-foreground">
                                    {member.name}
                                  </span>
                                  <Badge variant="outline">
                                    {member.phone}
                                  </Badge>
                                  {memberGroupMap[member.id]?.map(
                                    (groupName) => (
                                      <Badge
                                        key={groupName}
                                        variant="secondary"
                                        className="text-xs bg-primary/10 text-primary"
                                      >
                                        <Users className="w-3 h-3 mr-1" />
                                        {groupName}
                                      </Badge>
                                    ),
                                  )}
                                </div>
                                <div className="mt-2 space-y-1">
                                  {memberLessons.map(({ lesson, attended }) => {
                                    const typeInfo = getLessonTypeInfo(
                                      lesson.lessonType,
                                    );
                                    const pricePerStudent =
                                      lesson.price / lesson.students.length;
                                    const isPerSession =
                                      lesson.billingType !== "monthly";
                                    return (
                                      <div
                                        key={lesson.id}
                                        className={`text-sm flex justify-between ${attended ? "text-muted-foreground" : "text-muted-foreground/50 line-through"}`}
                                      >
                                        <span>
                                          {format(
                                            new Date(lesson.lessonDate),
                                            "MMM d",
                                          )}{" "}
                                          - {typeInfo?.name} ({lesson.duration}
                                          hr)
                                          {!attended &&
                                            isPerSession &&
                                            " (absent)"}
                                        </span>
                                        <span>
                                          {!attended && isPerSession
                                            ? "—"
                                            : `RM${pricePerStudent.toFixed(0)}`}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-foreground">
                                  RM{total.toFixed(0)}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {
                                    memberLessons.filter((l) => l.attended)
                                      .length
                                  }
                                  /{memberLessons.length} attended
                                </div>
                              </div>
                            </div>
                          </div>
                        ),
                      )}

                      <div className="border-t pt-4">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-medium">
                            Total Revenue
                          </span>
                          <span className="text-2xl font-bold">
                            RM
                            {getBillingByMember()
                              .reduce((sum, b) => sum + b.total, 0)
                              .toFixed(0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Trial Requests Tab */}
          {activeTab === "requests" && <TrialRequestsContent />}
        </>
      )}

      {/* Add Availability Dialog */}
      <Dialog
        open={availabilityDialogOpen}
        onOpenChange={setAvailabilityDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Coach Availability</DialogTitle>
            <DialogDescription>
              Set when you are available for training sessions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="mb-2 block">Days of Week</Label>
              <div className="grid grid-cols-4 gap-2">
                {DAYS_OF_WEEK.map((day, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    variant={availDays.includes(idx) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (availDays.includes(idx)) {
                        setAvailDays(availDays.filter((d) => d !== idx));
                      } else {
                        setAvailDays([...availDays, idx]);
                      }
                    }}
                  >
                    {day.slice(0, 3)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Select
                  value={availStartTime}
                  onValueChange={setAvailStartTime}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select start" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((slot) => (
                      <SelectItem key={slot.slotTime} value={slot.slotTime}>
                        {slot.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>End Time</Label>
                <Select value={availEndTime} onValueChange={setAvailEndTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select end" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.filter((s) => s.slotTime > availStartTime).map(
                      (slot) => (
                        <SelectItem key={slot.slotTime} value={slot.slotTime}>
                          {slot.displayName}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAvailabilityDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddAvailability}
              disabled={
                actionLoading ||
                availDays.length === 0 ||
                !availStartTime ||
                !availEndTime
              }
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Add Availability"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lesson Dialog */}
      <Dialog open={editLessonDialogOpen} onOpenChange={setEditLessonDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lesson</DialogTitle>
            <DialogDescription>
              Update lesson details for {editingLesson ? format(new Date(editingLesson.lessonDate), "EEEE, MMMM d, yyyy") : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Lesson Type</Label>
                <Select
                  value={editLessonType}
                  onValueChange={(v) => {
                    setEditLessonType(v);
                    setEditLessonDuration(getDefaultDuration(v));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {LESSON_TYPES.map((type) => (
                      <SelectItem key={type.slug} value={type.slug}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Duration</Label>
                <Select
                  value={editLessonDuration.toString()}
                  onValueChange={(v) => setEditLessonDuration(parseFloat(v))}
                  disabled={!editLessonType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {editLessonType &&
                      getDurationOptions(editLessonType).map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value.toString()}
                        >
                          {opt.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Court</Label>
                <Select
                  value={editLessonCourtId?.toString() || ""}
                  onValueChange={(v) => setEditLessonCourtId(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select court" />
                  </SelectTrigger>
                  <SelectContent>
                    {courts.map((court) => (
                      <SelectItem key={court.id} value={court.id.toString()}>
                        {court.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Time</Label>
                <Select
                  value={editLessonStartTime}
                  onValueChange={setEditLessonStartTime}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((slot) => (
                      <SelectItem key={slot.slotTime} value={slot.slotTime}>
                        {slot.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Teacher (Optional)</Label>
              <Select
                value={editLessonTeacherId}
                onValueChange={setEditLessonTeacherId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No teacher assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No teacher</SelectItem>
                  {activeTeachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editingLesson && !editingLesson.isOpenEnrollment && (
              <div>
                <Label>Students</Label>
                <div className="mt-2">
                  <Input
                    placeholder="Search by name or UID..."
                    value={editStudentSearch}
                    onChange={(e) => setEditStudentSearch(e.target.value)}
                    className="mb-2"
                  />
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {members
                      .filter((member) => {
                        if (!editStudentSearch) return true;
                        const search = editStudentSearch.toLowerCase();
                        return (
                          member.name.toLowerCase().includes(search) ||
                          member.uid.toLowerCase().includes(search)
                        );
                      })
                      .map((member) => (
                        <label
                          key={member.id}
                          className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${
                            editLessonStudentIds.includes(member.id)
                              ? "bg-primary/30 border-primary"
                              : "bg-card border-border"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={editLessonStudentIds.includes(member.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditLessonStudentIds([
                                  ...editLessonStudentIds,
                                  member.id,
                                ]);
                              } else {
                                setEditLessonStudentIds(
                                  editLessonStudentIds.filter(
                                    (id) => id !== member.id,
                                  ),
                                );
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-xs text-muted-foreground/70">
                            #{member.uid}
                          </span>
                          <span className="text-foreground">{member.name}</span>
                          {member.skillLevel && (
                            <Badge variant="outline" className="text-xs">
                              {member.skillLevel}
                            </Badge>
                          )}
                        </label>
                      ))}
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={editLessonNotes}
                onChange={(e) => setEditLessonNotes(e.target.value)}
                placeholder="Any notes about this session"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditLessonDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditLesson}
              disabled={
                actionLoading ||
                !editLessonCourtId ||
                !editLessonStartTime ||
                !editLessonType
              }
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Lesson</DialogTitle>
            <DialogDescription>
              Schedule a lesson for {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Lesson Type</Label>
                <Select
                  value={lessonType}
                  onValueChange={(v) => {
                    setLessonType(v);
                    setLessonDuration(getDefaultDuration(v));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {LESSON_TYPES.map((type) => (
                      <SelectItem key={type.slug} value={type.slug}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {lessonType && isMonthlyBilling(lessonType) && (
                  <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                    <Repeat className="w-3 h-3" />
                    Monthly billing - 4 sessions/month
                  </p>
                )}
              </div>
              <div>
                <Label>Duration</Label>
                {lessonType && isMonthlyBilling(lessonType) ? (
                  <div className="mt-2 p-3 bg-secondary rounded-lg text-sm text-muted-foreground">
                    Duration is set by monthly schedule
                  </div>
                ) : (
                  <Select
                    value={lessonDuration.toString()}
                    onValueChange={(v) => setLessonDuration(parseFloat(v))}
                    disabled={!lessonType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      {lessonType &&
                        getDurationOptions(lessonType).map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value.toString()}
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Price Display */}
            {lessonType && (
              <div className="p-3 bg-primary/30 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {isMonthlyBilling(lessonType)
                        ? "Monthly Price"
                        : "Session Price"}
                    </span>
                    {(() => {
                      const typeConfig = getLessonType(lessonType);
                      const perPersonPrice = getPricePerPerson(
                        lessonType,
                        lessonDuration,
                      );
                      const totalPrice = getLessonPrice(
                        lessonType,
                        lessonDuration,
                      );
                      const showPerPerson =
                        perPersonPrice &&
                        typeConfig &&
                        typeConfig.maxStudents > 1 &&
                        !isMonthlyBilling(lessonType);

                      if (showPerPerson) {
                        return (
                          <div>
                            <p className="font-bold text-xl text-foreground">
                              RM{perPersonPrice}{" "}
                              <span className="text-sm font-normal">
                                / person
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              (Total: RM{totalPrice})
                            </p>
                          </div>
                        );
                      }

                      return (
                        <p className="font-bold text-xl text-foreground">
                          RM{totalPrice}
                          {isMonthlyBilling(lessonType) && (
                            <span className="text-sm font-normal">/month</span>
                          )}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>
                      Max {getLessonType(lessonType)?.maxStudents} student(s)
                    </p>
                    {!isMonthlyBilling(lessonType) && (
                      <p>{lessonDuration} hours</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Court</Label>
                <Select
                  value={lessonCourtId?.toString() || ""}
                  onValueChange={(v) => setLessonCourtId(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select court" />
                  </SelectTrigger>
                  <SelectContent>
                    {courts.map((court) => (
                      <SelectItem key={court.id} value={court.id.toString()}>
                        {court.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Time</Label>
                <Select
                  value={lessonStartTime}
                  onValueChange={setLessonStartTime}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((slot) => (
                      <SelectItem key={slot.slotTime} value={slot.slotTime}>
                        {slot.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Teacher (Optional)</Label>
              <Select
                value={lessonTeacherId}
                onValueChange={setLessonTeacherId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No teacher assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No teacher</SelectItem>
                  {activeTeachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {trainingGroups.length > 0 && (
              <div>
                <Label>Training Group (quick fill)</Label>
                <Select
                  value={selectedGroupId}
                  onValueChange={(v) => {
                    setSelectedGroupId(v);
                    if (v === "none") {
                      setLessonStudentIds([]);
                      return;
                    }
                    const group = trainingGroups.find((g) => g.id === v);
                    if (group) {
                      setLessonStudentIds(group.members.map((m) => m.id));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a group to auto-fill students" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (pick manually)</SelectItem>
                    {trainingGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} ({group.members.length} members)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Students</Label>
              <div className="mt-2">
                <Input
                  placeholder="Search by name or UID..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="mb-2"
                />
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {members
                    .filter((member) => {
                      if (!studentSearch) return true;
                      const search = studentSearch.toLowerCase();
                      return (
                        member.name.toLowerCase().includes(search) ||
                        member.uid.toLowerCase().includes(search)
                      );
                    })
                    .map((member) => (
                      <label
                        key={member.id}
                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${
                          lessonStudentIds.includes(member.id)
                            ? "bg-primary/30 border-primary"
                            : "bg-card border-border"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={lessonStudentIds.includes(member.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setLessonStudentIds([
                                ...lessonStudentIds,
                                member.id,
                              ]);
                            } else {
                              setLessonStudentIds(
                                lessonStudentIds.filter(
                                  (id) => id !== member.id,
                                ),
                              );
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-xs text-muted-foreground/70">
                          #{member.uid}
                        </span>
                        <span className="text-foreground">{member.name}</span>
                        {member.skillLevel && (
                          <Badge variant="outline" className="text-xs">
                            {member.skillLevel}
                          </Badge>
                        )}
                      </label>
                    ))}
                  {members.filter((member) => {
                    if (!studentSearch) return true;
                    const search = studentSearch.toLowerCase();
                    return (
                      member.name.toLowerCase().includes(search) ||
                      member.uid.toLowerCase().includes(search)
                    );
                  }).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No members found
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={lessonNotes}
                onChange={(e) => setLessonNotes(e.target.value)}
                placeholder="Any notes about this session"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLessonDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddLesson}
              disabled={
                actionLoading ||
                !lessonCourtId ||
                !lessonStartTime ||
                !lessonType ||
                lessonStudentIds.length === 0
              }
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Schedule Lesson"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Request Dialog - Select Court */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Approve Lesson Request</DialogTitle>
            <DialogDescription>
              Select an available court for this lesson
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="py-4 space-y-4">
              {/* Request Info */}
              <div className="p-4 bg-primary/30 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg text-foreground">
                      {selectedRequest.member.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedRequest.lessonType.replace("-", " ")} lesson (
                      {selectedRequest.requestedDuration}hr)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">
                      {format(
                        new Date(selectedRequest.requestedDate),
                        "EEE, MMM d",
                      )}
                    </p>
                    <p className="text-lg font-bold text-foreground">
                      {selectedRequest.requestedTime}
                    </p>
                    <p className="text-sm font-medium text-green-700">
                      RM
                      {getLessonPrice(
                        selectedRequest.lessonType,
                        selectedRequest.requestedDuration,
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Court Selection Grid */}
              <div>
                <Label className="mb-3 block">Select Court</Label>
                {loadingAvailability ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/70" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {courts.map((court) => {
                      const isAvailable = courtAvailability[court.id] !== false;
                      const isSelected = approveCourtId === court.id;
                      return (
                        <button
                          key={court.id}
                          onClick={() =>
                            isAvailable && setApproveCourtId(court.id)
                          }
                          disabled={!isAvailable}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            !isAvailable
                              ? "bg-secondary border-border cursor-not-allowed opacity-60"
                              : isSelected
                                ? "bg-green-100 border-green-500 ring-2 ring-green-500"
                                : "bg-card border-border hover:border-green-600 hover:bg-green-100"
                          }`}
                        >
                          <p
                            className={`font-semibold ${isSelected ? "text-green-700" : "text-foreground"}`}
                          >
                            {court.name}
                          </p>
                          <p
                            className={`text-sm mt-1 ${
                              !isAvailable
                                ? "text-red-600"
                                : isSelected
                                  ? "text-green-700"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {!isAvailable
                              ? "Booked"
                              : isSelected
                                ? "Selected"
                                : "Available"}
                          </p>
                          {isSelected && (
                            <div className="mt-2">
                              <Check className="w-5 h-5 text-green-700 mx-auto" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Time slot info */}
              {approveCourtId && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-300">
                  <p className="text-sm text-green-600">
                    <strong>
                      {courts.find((c) => c.id === approveCourtId)?.name}
                    </strong>{" "}
                    will be booked for{" "}
                    <strong>{selectedRequest.member.name}</strong> on{" "}
                    <strong>
                      {format(new Date(selectedRequest.requestedDate), "MMM d")}
                    </strong>{" "}
                    at <strong>{selectedRequest.requestedTime}</strong> (
                    {selectedRequest.requestedDuration}hr) -{" "}
                    <strong>
                      RM
                      {getLessonPrice(
                        selectedRequest.lessonType,
                        selectedRequest.requestedDuration,
                      )}
                    </strong>
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApproveWithCourt}
              disabled={actionLoading || !approveCourtId}
              className="bg-green-600 hover:bg-green-700"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Approve & Schedule"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Availability Dialog */}
      <Dialog open={editAvailDialogOpen} onOpenChange={setEditAvailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Availability</DialogTitle>
            <DialogDescription>
              Update the day and time for this availability slot
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="mb-2 block">Day of Week</Label>
              <Select
                value={editAvailDay.toString()}
                onValueChange={(v) => setEditAvailDay(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Select
                  value={editAvailStartTime}
                  onValueChange={setEditAvailStartTime}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select start" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((slot) => (
                      <SelectItem key={slot.slotTime} value={slot.slotTime}>
                        {slot.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>End Time</Label>
                <Select
                  value={editAvailEndTime}
                  onValueChange={setEditAvailEndTime}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select end" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.filter(
                      (s) => s.slotTime > editAvailStartTime,
                    ).map((slot) => (
                      <SelectItem key={slot.slotTime} value={slot.slotTime}>
                        {slot.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditAvailDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditAvailability}
              disabled={
                actionLoading || !editAvailStartTime || !editAvailEndTime
              }
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Details Dialog */}
      <Dialog
        open={requestDetailsDialogOpen}
        onOpenChange={setRequestDetailsDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lesson Request Details</DialogTitle>
            <DialogDescription>
              Review and take action on this request
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="py-4 space-y-4">
              {/* Member Info */}
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-300">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-orange-700" />
                  <span className="font-semibold text-lg text-foreground">
                    {selectedRequest.member.name}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    <strong>Phone:</strong> {selectedRequest.member.phone}
                  </p>
                  {selectedRequest.member.skillLevel && (
                    <p>
                      <strong>Skill Level:</strong>{" "}
                      {selectedRequest.member.skillLevel}
                    </p>
                  )}
                </div>
              </div>

              {/* Request Details */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium text-foreground">
                    {format(
                      new Date(selectedRequest.requestedDate),
                      "EEEE, MMM d, yyyy",
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time:</span>
                  <span className="font-medium text-foreground">
                    {selectedRequest.requestedTime}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium text-foreground">
                    {getLessonTypeInfo(selectedRequest.lessonType)?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-medium text-foreground">
                    {selectedRequest.requestedDuration} hour(s)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price:</span>
                  <span className="font-medium text-green-700">
                    RM
                    {getLessonPrice(
                      selectedRequest.lessonType,
                      selectedRequest.requestedDuration,
                    )}
                  </span>
                </div>
              </div>

              {/* Request timestamp */}
              <p className="text-xs text-muted-foreground/70">
                Requested on{" "}
                {format(
                  new Date(selectedRequest.createdAt),
                  "MMM d, yyyy h:mm a",
                )}
              </p>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
              onClick={() => {
                const notes = prompt("Reason for rejection (optional):");
                if (selectedRequest) {
                  handleRequestAction(
                    selectedRequest.id,
                    "rejected",
                    notes || undefined,
                  );
                  setRequestDetailsDialogOpen(false);
                }
              }}
              disabled={actionLoading}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Reject
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (selectedRequest) {
                  setSuggestDate(new Date(selectedRequest.requestedDate));
                  setSuggestTime(selectedRequest.requestedTime);
                  setSuggestNotes("");
                  setSuggestTimeDialogOpen(true);
                }
              }}
              disabled={actionLoading}
            >
              <Clock className="w-4 h-4 mr-2" />
              Suggest Time
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApproveFromDetails}
              disabled={actionLoading}
            >
              <Check className="w-4 h-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suggest Time Dialog */}
      <Dialog
        open={suggestTimeDialogOpen}
        onOpenChange={setSuggestTimeDialogOpen}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-foreground" />
              Suggest Alternative Time
            </DialogTitle>
            <DialogDescription>
              Suggest a different date and time for this lesson request. The
              member will be notified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Original Request Info */}
            {selectedRequest && (
              <div className="p-3 bg-secondary rounded-lg border border-border">
                <p className="text-sm text-muted-foreground mb-1">
                  Original request:
                </p>
                <p className="font-medium text-foreground">
                  {format(
                    new Date(selectedRequest.requestedDate),
                    "EEEE, MMMM d, yyyy",
                  )}{" "}
                  at{" "}
                  {(() => {
                    const [h, m] = selectedRequest.requestedTime
                      .split(":")
                      .map(Number);
                    const period = h >= 12 ? "PM" : "AM";
                    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
                    return `${displayHour}:${m.toString().padStart(2, "0")} ${period}`;
                  })()}
                </p>
              </div>
            )}

            {/* Date Picker */}
            <div className="space-y-2">
              <Label>Suggested Date</Label>
              <div className="border rounded-lg p-3">
                <Calendar
                  mode="single"
                  selected={suggestDate}
                  onSelect={setSuggestDate}
                  disabled={(date) =>
                    date < new Date(new Date().setHours(0, 0, 0, 0))
                  }
                  className="mx-auto"
                />
              </div>
            </div>

            {/* Time Picker */}
            <div className="space-y-2">
              <Label>Suggested Time</Label>
              <Select value={suggestTime} onValueChange={setSuggestTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot.slotTime} value={slot.slotTime}>
                      {slot.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Note to Member (optional)</Label>
              <Input
                placeholder="e.g., This slot works better with my schedule"
                value={suggestNotes}
                onChange={(e) => setSuggestNotes(e.target.value)}
              />
            </div>

            {/* Preview */}
            {suggestDate && suggestTime && (
              <div className="p-3 bg-primary/30 rounded-lg border border-border">
                <p className="text-sm text-foreground mb-1">
                  New suggested time:
                </p>
                <p className="font-medium text-primary">
                  {format(suggestDate, "EEEE, MMMM d, yyyy")} at{" "}
                  {(() => {
                    const [h, m] = suggestTime.split(":").map(Number);
                    const period = h >= 12 ? "PM" : "AM";
                    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
                    return `${displayHour}:${m.toString().padStart(2, "0")} ${period}`;
                  })()}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSuggestTimeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedRequest && suggestDate && suggestTime) {
                  const suggestedDateTime = `${format(suggestDate, "yyyy-MM-dd")} ${suggestTime}`;
                  handleRequestAction(
                    selectedRequest.id,
                    "changed",
                    suggestNotes || undefined,
                    suggestedDateTime,
                  );
                  setSuggestTimeDialogOpen(false);
                  setRequestDetailsDialogOpen(false);
                }
              }}
              disabled={actionLoading || !suggestDate || !suggestTime}
            >
              {actionLoading && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              Send Suggestion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AttendanceDialog
        open={attendanceDialogOpen}
        onOpenChange={setAttendanceDialogOpen}
        lessonId={attendanceLessonId}
        lessonLabel={attendanceLessonLabel}
        onSaved={() => {
          fetchLessonsForDate();
        }}
      />
    </div>
  );
}
