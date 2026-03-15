"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, Repeat, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface LessonTypeOption {
  slug: string;
  name: string;
  maxStudents: number;
  pricingTiers: { duration: number; price: number }[];
  isActive: boolean;
}

interface StudentOption {
  id: string;
  name: string;
  isTrainee?: boolean;
}

interface TeacherOption {
  id: string;
  name: string;
}

interface GridRecurringLessonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courtId: number | null;
  courtName: string;
  slotTime: string | null;
  selectedDate: Date;
  onSuccess: () => void;
}

export function GridRecurringLessonDialog({
  open,
  onOpenChange,
  courtId,
  courtName,
  slotTime,
  selectedDate,
  onSuccess,
}: GridRecurringLessonDialogProps) {
  const t = useTranslations("admin.bookings");

  const [lessonTypes, setLessonTypes] = useState<LessonTypeOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [fetchingData, setFetchingData] = useState(false);
  const [lastFetchedOpen, setLastFetchedOpen] = useState(false);

  const [lessonType, setLessonType] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [dayOfWeekState, setDayOfWeekState] = useState<number>(
    selectedDate.getDay(),
  );
  const [submitting, setSubmitting] = useState(false);

  if (open && !lastFetchedOpen) {
    setLastFetchedOpen(true);
    setStartDate(format(selectedDate, "yyyy-MM-dd"));
    setDayOfWeekState(selectedDate.getDay());
    setFetchingData(true);
    Promise.all([
      fetch("/api/admin/lesson-types").then((r) => r.json()),
      fetch("/api/admin/members").then((r) => r.json()),
      fetch("/api/admin/staff").then((r) => r.json()),
    ])
      .then(([typesData, membersData, staffData]) => {
        const types: LessonTypeOption[] = Array.isArray(typesData)
          ? typesData
          : (typesData?.lessonTypes ?? []);
        setLessonTypes(types.filter((lt) => lt.isActive !== false));
        setStudents(
          (membersData?.all ?? membersData?.members ?? []).filter(
            (m: StudentOption) => m.isTrainee,
          ),
        );
        setTeachers(staffData?.teachers ?? []);
      })
      .catch((err) => {
        console.error(err);
        toast.error(t("addError"));
      })
      .finally(() => setFetchingData(false));
  }

  if (!open && lastFetchedOpen) {
    setLastFetchedOpen(false);
  }

  const resetForm = () => {
    setLessonType("");
    setDuration(null);
    setTeacherId("");
    setSelectedStudentIds([]);
    setStartDate("");
    setEndDate("");
    setNotes("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const selectedType = lessonTypes.find((lt) => lt.slug === lessonType);
  const maxStudents = selectedType?.maxStudents ?? 999;
  const durationOptions =
    selectedType?.pricingTiers.map((tier) => ({
      value: tier.duration,
      label: `${tier.duration} ${tier.duration === 1 ? t("hourSingular") : t("hourPlural")} (RM${tier.price})`,
    })) ?? [];

  const dayOfWeek = dayOfWeekState;

  const toggleStudent = (id: string) =>
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );

  const isValid =
    lessonType !== "" &&
    selectedStudentIds.length > 0 &&
    startDate !== "" &&
    (durationOptions.length === 0 || duration !== null);

  const handleSubmit = async () => {
    if (!courtId || !slotTime || !isValid) return;
    setSubmitting(true);
    try {
      const effectiveDuration = duration ?? durationOptions[0]?.value ?? 1.5;
      const res = await fetch("/api/admin/recurring-lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayOfWeek,
          startTime: slotTime,
          lessonType,
          duration: effectiveDuration,
          courtId,
          teacherId: teacherId || null,
          studentIds: selectedStudentIds,
          startDate,
          ...(endDate ? { endDate } : {}),
          ...(notes ? { notes } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("addError"));
        return;
      }
      toast.success(t("addSuccess"));
      handleOpenChange(false);
      onSuccess();
    } catch {
      toast.error(t("addError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="w-5 h-5" />
            {t("createRecurringLessonTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("repeatWeekly")} — {courtName} @ {slotTime}, {DAYS[dayOfWeek]}s
          </DialogDescription>
        </DialogHeader>

        {fetchingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("lessonType")} *</Label>
                <Select
                  value={lessonType}
                  onValueChange={(v) => {
                    setLessonType(v);
                    setDuration(null);
                    setSelectedStudentIds([]);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t("lessonType")} />
                  </SelectTrigger>
                  <SelectContent>
                    {lessonTypes.map((lt) => (
                      <SelectItem key={lt.slug} value={lt.slug}>
                        {lt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {durationOptions.length > 0 && (
                <div>
                  <Label>{t("duration")} *</Label>
                  <Select
                    value={duration?.toString() ?? ""}
                    onValueChange={(v) => setDuration(parseFloat(v))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={t("duration")} />
                    </SelectTrigger>
                    <SelectContent>
                      {durationOptions.map((opt) => (
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
              )}
            </div>

            <div>
              <Label>
                {t("students")} * ({selectedStudentIds.length}
                {selectedType ? `/${maxStudents}` : ""})
              </Label>
              <div className="flex flex-wrap gap-1.5 mt-2 max-h-28 overflow-y-auto border border-border rounded-md p-2">
                {students.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("noTrainees")}
                  </p>
                ) : (
                  students.map((s) => {
                    const isSelected = selectedStudentIds.includes(s.id);
                    const atMax =
                      selectedStudentIds.length >= maxStudents && !isSelected;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={atMax}
                        onClick={() => toggleStudent(s.id)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                          isSelected
                            ? "bg-primary text-white"
                            : atMax
                              ? "bg-muted text-muted-foreground/50 cursor-not-allowed"
                              : "bg-secondary text-foreground hover:bg-primary/20"
                        }`}
                      >
                        {s.name}
                        {isSelected && <X className="w-3 h-3" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {teachers.length > 0 && (
              <div>
                <Label>{t("teacher")}</Label>
                <Select value={teacherId} onValueChange={setTeacherId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t("selectTeacher")} />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((tc) => (
                      <SelectItem key={tc.id} value={tc.id}>
                        {tc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>{t("dayOfWeekLabel")} *</Label>
              <Select
                value={dayOfWeekState.toString()}
                onValueChange={(v) => setDayOfWeekState(parseInt(v))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t("notes")}</Label>
              <Textarea
                className="mt-1"
                placeholder={t("notesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("startDateLabel")} *</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("endDateLabel")}</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !isValid}>
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Repeat className="w-4 h-4 mr-2" />
            )}
            {t("createRecurringLessonTitle")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
