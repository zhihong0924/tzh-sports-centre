"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { GraduationCap, Loader2, Trash2, CheckSquare } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIME_SLOTS = Array.from({ length: 29 }, (_, i) => {
  const hour = Math.floor(i / 2) + 9;
  const minutes = i % 2 === 0 ? "00" : "30";
  const slotTime = `${hour.toString().padStart(2, "0")}:${minutes}`;
  const ampm = hour < 12 ? "AM" : "PM";
  const displayHour = hour <= 12 ? hour : hour - 12;
  return { slotTime, displayName: `${displayHour}:${minutes} ${ampm}` };
});

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
  uid: string;
  skillLevel?: string;
}

interface TeacherOption {
  id: string;
  name: string;
}

interface CourtOption {
  id: number;
  name: string;
}

interface LessonDetails {
  id: string;
  lessonDate: string;
  lessonType: string;
  duration: number;
  courtId: number;
  startTime: string;
  notes: string | null;
  isOpenEnrollment: boolean;
  teacher: { id: string; name: string } | null;
  students: { id: string; name: string; uid?: string; skillLevel?: string }[];
}

interface GridEditLessonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: string | null;
  onSuccess: () => void;
  onCancel?: (lessonId: string) => void;
  onAttendance?: (lessonId: string) => void;
  lessonStatus?: string;
}

export function GridEditLessonDialog({
  open,
  onOpenChange,
  lessonId,
  onSuccess,
  onCancel,
  onAttendance,
  lessonStatus,
}: GridEditLessonDialogProps) {
  const [lessonTypes, setLessonTypes] = useState<LessonTypeOption[]>([]);
  const [allMembers, setAllMembers] = useState<StudentOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [lesson, setLesson] = useState<LessonDetails | null>(null);
  const [fetchingData, setFetchingData] = useState(false);
  const [lastFetchedLessonId, setLastFetchedLessonId] = useState<string | null>(null);

  // Form state
  const [editLessonType, setEditLessonType] = useState("");
  const [editDuration, setEditDuration] = useState<number>(1.5);
  const [editCourtId, setEditCourtId] = useState<number | null>(null);
  const [editStartTime, setEditStartTime] = useState("");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [editStudentIds, setEditStudentIds] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (open && lessonId && lessonId !== lastFetchedLessonId) {
    setLastFetchedLessonId(lessonId);
    setFetchingData(true);
    Promise.all([
      fetch(`/api/admin/lessons?lessonId=${lessonId}`).then((r) => r.json()),
      fetch("/api/admin/lesson-types").then((r) => r.json()),
      fetch("/api/admin/members").then((r) => r.json()),
      fetch("/api/admin/staff").then((r) => r.json()),
      fetch("/api/courts").then((r) => r.json()),
    ])
      .then(([lessonData, typesData, membersData, staffData, courtsData]) => {
        const lessonRecord: LessonDetails = lessonData?.lesson || lessonData;
        if (lessonRecord) {
          setLesson(lessonRecord);
          setEditLessonType(lessonRecord.lessonType);
          setEditDuration(lessonRecord.duration);
          setEditCourtId(lessonRecord.courtId);
          setEditStartTime(lessonRecord.startTime);
          setEditTeacherId(lessonRecord.teacher?.id || "none");
          setEditStudentIds(lessonRecord.students.map((s) => s.id));
          setEditNotes(lessonRecord.notes || "");
        }
        const types: LessonTypeOption[] = Array.isArray(typesData)
          ? typesData
          : typesData?.lessonTypes || [];
        setLessonTypes(types.filter((lt) => lt.isActive !== false));
        setAllMembers(
          (membersData?.all || membersData?.members || []).filter(
            (m: StudentOption & { isTrainee?: boolean }) => m.isTrainee,
          ),
        );
        setTeachers(staffData?.teachers || []);
        setCourts(Array.isArray(courtsData) ? courtsData : courtsData?.courts || []);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load lesson data");
      })
      .finally(() => setFetchingData(false));
  }

  if (!open && lastFetchedLessonId) {
    setLastFetchedLessonId(null);
    setLesson(null);
    setStudentSearch("");
  }

  const selectedType = lessonTypes.find((lt) => lt.slug === editLessonType);
  const durationOptions =
    selectedType?.pricingTiers.map((tier) => ({
      value: tier.duration,
      label: `${tier.duration}hr (RM${tier.price})`,
    })) ?? [];

  const handleSubmit = async () => {
    if (!lessonId || !editCourtId || !editStartTime || !editLessonType) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/lessons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          courtId: editCourtId,
          startTime: editStartTime,
          lessonType: editLessonType,
          duration: editDuration,
          studentIds: lesson?.isOpenEnrollment ? undefined : editStudentIds,
          notes: editNotes || null,
          teacherId: editTeacherId && editTeacherId !== "none" ? editTeacherId : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update lesson");
        return;
      }
      toast.success("Lesson updated");
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("Failed to update lesson");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMembers = allMembers.filter((m) => {
    if (!studentSearch) return true;
    const s = studentSearch.toLowerCase();
    return m.name.toLowerCase().includes(s) || m.uid?.toLowerCase().includes(s);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Edit Lesson
          </DialogTitle>
          <DialogDescription>
            {lesson ? format(new Date(lesson.lessonDate), "EEEE, MMMM d, yyyy") : ""}
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
                <Label>Lesson Type</Label>
                <Select
                  value={editLessonType}
                  onValueChange={(v) => {
                    setEditLessonType(v);
                    const type = lessonTypes.find((lt) => lt.slug === v);
                    setEditDuration(type?.pricingTiers[0]?.duration ?? 1.5);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select type" />
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
              <div>
                <Label>Duration</Label>
                <Select
                  value={editDuration.toString()}
                  onValueChange={(v) => setEditDuration(parseFloat(v))}
                  disabled={durationOptions.length === 0}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select duration" />
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Court</Label>
                <Select
                  value={editCourtId?.toString() || ""}
                  onValueChange={(v) => setEditCourtId(parseInt(v))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select court" />
                  </SelectTrigger>
                  <SelectContent>
                    {courts.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Time</Label>
                <Select value={editStartTime} onValueChange={setEditStartTime}>
                  <SelectTrigger className="mt-1">
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
              <Select value={editTeacherId} onValueChange={setEditTeacherId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="No teacher assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No teacher</SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {lesson && !lesson.isOpenEnrollment && (
              <div>
                <Label>Students</Label>
                <Input
                  placeholder="Search by name or UID..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="mt-1 mb-2"
                />
                <div className="space-y-1 max-h-40 overflow-y-auto border border-border rounded-md p-2">
                  {filteredMembers.map((member) => (
                    <label
                      key={member.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm ${
                        editStudentIds.includes(member.id)
                          ? "bg-primary/20 border border-primary/40"
                          : "hover:bg-secondary"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={editStudentIds.includes(member.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditStudentIds([...editStudentIds, member.id]);
                          } else {
                            setEditStudentIds(editStudentIds.filter((id) => id !== member.id));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-xs text-muted-foreground">#{member.uid}</span>
                      <span>{member.name}</span>
                      {member.skillLevel && (
                        <Badge variant="outline" className="text-xs ml-auto">
                          {member.skillLevel}
                        </Badge>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Any notes about this session"
                className="mt-1"
              />
            </div>

            {(onCancel || onAttendance) && (
              <div className="flex gap-2 pt-2 border-t border-border">
                {onAttendance && lessonStatus === "scheduled" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-green-700 border-green-300 hover:bg-green-50"
                    onClick={() => {
                      onOpenChange(false);
                      if (lessonId) onAttendance(lessonId);
                    }}
                  >
                    <CheckSquare className="w-4 h-4 mr-1" />
                    Attendance
                  </Button>
                )}
                {onCancel && lessonStatus === "scheduled" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-300 hover:bg-red-50 ml-auto"
                    onClick={() => {
                      onOpenChange(false);
                      if (lessonId) onCancel(lessonId);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Cancel Lesson
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || fetchingData || !editCourtId || !editStartTime || !editLessonType}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
