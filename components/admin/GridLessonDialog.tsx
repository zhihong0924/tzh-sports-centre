"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { GraduationCap, Loader2, X } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LessonTypeOption {
  slug: string;
  name: string;
  maxStudents: number;
  billingType: string;
  pricingTiers: { duration: number; price: number }[];
  isActive: boolean;
}

interface StudentOption {
  id: string;
  name: string;
  uid: string;
}

interface TeacherOption {
  id: string;
  name: string;
}

interface GridLessonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courtId: number | null;
  courtName: string;
  slotTime: string | null;
  lessonDate: Date;
  onSuccess: () => void;
}

export function GridLessonDialog({
  open,
  onOpenChange,
  courtId,
  courtName,
  slotTime,
  lessonDate,
  onSuccess,
}: GridLessonDialogProps) {
  const t = useTranslations("admin.bookings");

  const [lessonTypes, setLessonTypes] = useState<LessonTypeOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [fetchingData, setFetchingData] = useState(false);
  const [lastFetchedOpen, setLastFetchedOpen] = useState(false);

  const [lessonType, setLessonType] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [notes, setNotes] = useState("");
  const [isOpenEnrollment, setIsOpenEnrollment] = useState(false);
  const [pricePerStudent, setPricePerStudent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (open && !lastFetchedOpen) {
    setLastFetchedOpen(true);
    setFetchingData(true);
    Promise.all([
      fetch("/api/admin/lesson-types").then((r) => r.json()),
      fetch("/api/admin/members").then((r) => r.json()),
      fetch("/api/admin/staff").then((r) => r.json()),
    ])
      .then(([typesData, membersData, staffData]) => {
        const types: LessonTypeOption[] = Array.isArray(typesData)
          ? typesData
          : typesData?.lessonTypes || [];
        setLessonTypes(types.filter((lt) => lt.isActive !== false));
        setStudents(
          (membersData?.all || membersData?.members || []).filter(
            (m: StudentOption & { isTrainee?: boolean }) => m.isTrainee,
          ),
        );
        setTeachers(staffData?.teachers || []);
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
    setSelectedStudentIds([]);
    setTeacherId("");
    setNotes("");
    setIsOpenEnrollment(false);
    setPricePerStudent("");
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

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleLessonTypeChange = (slug: string) => {
    setLessonType(slug);
    setDuration(null);
    setSelectedStudentIds([]);
  };

  const isValid =
    lessonType !== "" &&
    (isOpenEnrollment || selectedStudentIds.length > 0) &&
    (durationOptions.length === 0 || duration !== null);

  const handleSubmit = async () => {
    if (!courtId || !slotTime || !isValid) return;
    setSubmitting(true);
    try {
      const effectiveDuration = duration ?? (durationOptions[0]?.value || 1.5);
      const res = await fetch("/api/admin/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId,
          lessonDate: format(lessonDate, "yyyy-MM-dd"),
          startTime: slotTime,
          lessonType,
          duration: effectiveDuration,
          studentIds: selectedStudentIds,
          teacherId: teacherId || undefined,
          notes: notes || undefined,
          isOpenEnrollment,
          pricePerStudent: pricePerStudent ? parseFloat(pricePerStudent) : undefined,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            {t("createLessonTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("createLessonDescription")} {courtName} @ {slotTime}
          </DialogDescription>
        </DialogHeader>

        {fetchingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div>
              <Label>{t("lessonType")} *</Label>
              <Select value={lessonType} onValueChange={handleLessonTypeChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t("lessonType")} />
                </SelectTrigger>
                <SelectContent>
                  {lessonTypes.map((lt) => (
                    <SelectItem key={lt.slug} value={lt.slug}>
                      {lt.name} (max {lt.maxStudents})
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
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="open-enrollment">{t("openEnrollment")}</Label>
              <Switch
                id="open-enrollment"
                checked={isOpenEnrollment}
                onCheckedChange={setIsOpenEnrollment}
              />
            </div>

            {isOpenEnrollment && (
              <div>
                <Label>{t("pricePerStudent")} (RM)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1"
                  placeholder={t("pricePerStudentPlaceholder")}
                  value={pricePerStudent}
                  onChange={(e) => setPricePerStudent(e.target.value)}
                />
              </div>
            )}

            <div>
              <Label>
                {t("students")} {isOpenEnrollment ? "" : "*"} ({selectedStudentIds.length}
                {selectedType ? `/${maxStudents}` : ""})
              </Label>
              <div className="flex flex-wrap gap-1.5 mt-2 max-h-32 overflow-y-auto border border-border rounded-md p-2">
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
              <Label>{t("notes")}</Label>
              <Textarea
                className="mt-1"
                placeholder={t("notesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
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
              <GraduationCap className="w-4 h-4 mr-2" />
            )}
            {t("createLessonTitle")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
