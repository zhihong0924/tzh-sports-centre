"use client";

import { Suspense, useState, useEffect } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  User,
  CalendarDays,
  GraduationCap,
  Settings,
  CreditCard,
  Repeat,
  CalendarX2,
  Camera,
  Loader2,
  Wrench,
  X,
  Receipt,
} from "lucide-react";
import { PersonalInfoTab } from "@/components/profile/PersonalInfoTab";
import { BookingsTab } from "@/components/profile/BookingsTab";
import { RecurringTab } from "@/components/profile/RecurringTab";
import { LessonsTab } from "@/components/profile/LessonsTab";
import { AbsencesTab } from "@/components/profile/AbsencesTab";
import { RacketsTab } from "@/components/profile/RacketsTab";
import { SettingsTab } from "@/components/profile/SettingsTab";
import { BillingTab } from "@/components/profile/BillingTab";
import { SkeletonProfile } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";

type TabType =
  | "personal"
  | "bookings"
  | "recurring"
  | "rackets"
  | "lessons"
  | "absences"
  | "billing"
  | "settings";

interface UserProfile {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone: string;
  emergencyContact: string | null;
  creditBalance: number;
  createdAt: string;
  isMember: boolean;
  isTrainee: boolean;
  avatarUrl: string | null;
  notifyBookingConfirm: boolean;
  notifyBookingReminder: boolean;
  notifyCancellation: boolean;
  notifyLessonUpdates: boolean;
}

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("profile");
  const tabParam = searchParams.get("tab") as TabType | null;
  const validTabs: TabType[] = [
    "personal",
    "bookings",
    "recurring",
    "rackets",
    "lessons",
    "absences",
    "billing",
    "settings",
  ];
  const [activeTab, setActiveTab] = useState<TabType>(
    tabParam && validTabs.includes(tabParam) ? tabParam : "personal",
  );
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Please upload a JPG, PNG, or WebP image");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Image must be under 3MB");
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.avatarUrl) {
        setProfile((prev) =>
          prev ? { ...prev, avatarUrl: data.avatarUrl } : prev,
        );
        toast.success("Profile picture updated");
      } else {
        toast.error(data.error || "Failed to upload");
      }
    } catch {
      toast.error("Failed to upload");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarUploading(true);
    try {
      const res = await fetch("/api/upload/avatar", { method: "DELETE" });
      if (res.ok) {
        setProfile((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
        toast.success("Profile picture removed");
      } else {
        toast.error("Failed to remove");
      }
    } catch {
      toast.error("Failed to remove");
    } finally {
      setAvatarUploading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login?callbackUrl=/profile");
    }
  }, [status, router]);

  useEffect(() => {
    const verify = searchParams.get("verify");
    if (!verify) return;
    const messages: Record<
      string,
      { type: "success" | "error"; text: string }
    > = {
      success: {
        type: "success",
        text: "Email verified successfully! Your email has been updated.",
      },
      expired: {
        type: "error",
        text: "Verification link has expired. Please request a new one from your profile.",
      },
      taken: {
        type: "error",
        text: "That email address is already in use by another account.",
      },
      error: {
        type: "error",
        text: "Something went wrong during verification. Please try again.",
      },
    };
    const msg = messages[verify];
    if (msg) {
      if (msg.type === "success") toast.success(msg.text, { duration: 6000 });
      else toast.error(msg.text, { duration: 6000 });
    }
    router.replace("/profile", { scroll: false });
  }, [searchParams, router]);

  useEffect(() => {
    if (session?.user) {
      fetchProfile();
    }
  }, [session]);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (res.ok) {
        setProfile(data);
      } else {
        console.error("Profile fetch failed:", data.error);
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
        <SkeletonProfile />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const tabs = [
    { id: "personal" as TabType, label: t("tabs.personal"), icon: User },
    {
      id: "bookings" as TabType,
      label: t("tabs.bookings"),
      icon: CalendarDays,
    },
    { id: "recurring" as TabType, label: t("tabs.recurring"), icon: Repeat },
    { id: "rackets" as TabType, label: t("tabs.rackets"), icon: Wrench },
    ...(profile?.isTrainee
      ? [
          {
            id: "lessons" as TabType,
            label: t("tabs.lessons"),
            icon: GraduationCap,
          },
          {
            id: "absences" as TabType,
            label: t("tabs.absences"),
            icon: CalendarX2,
          },
        ]
      : []),
    { id: "billing" as TabType, label: t("tabs.billing"), icon: Receipt },
    { id: "settings" as TabType, label: t("tabs.settings"), icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative group">
              {profile?.avatarUrl ? (
                <>
                  <Image
                    src={`${profile.avatarUrl}?v=${Date.now()}`}
                    alt={profile.name}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-full object-cover"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={handleAvatarRemove}
                    disabled={avatarUploading}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full items-center justify-center hidden group-hover:flex"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold">
                  {profile?.name?.charAt(0).toUpperCase() || "U"}
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                {avatarUploading ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={avatarUploading}
                />
              </label>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {profile?.name}
              </h1>
              <p className="text-muted-foreground">{profile?.email}</p>
            </div>
          </div>

          {/* Credit Balance */}
          {profile && profile.creditBalance > 0 && (
            <div className="inline-flex items-center gap-2 bg-accent text-muted-foreground px-4 py-2 rounded-full">
              <CreditCard className="w-4 h-4" />
              <span className="font-medium">
                {t("credits.balance")}: RM{profile.creditBalance.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "personal" &&
            (profile ? (
              <PersonalInfoTab profile={profile} onUpdate={fetchProfile} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {t("loadingProfile")}
              </div>
            ))}
          {activeTab === "bookings" && (
            <BookingsTab
              creditBalance={profile?.creditBalance || 0}
              onCreditUpdate={fetchProfile}
            />
          )}
          {activeTab === "recurring" && <RecurringTab />}
          {activeTab === "rackets" && <RacketsTab />}
          {activeTab === "lessons" && profile?.isTrainee && <LessonsTab />}
          {activeTab === "absences" && profile?.isTrainee && <AbsencesTab />}
          {activeTab === "billing" && <BillingTab />}
          {activeTab === "settings" &&
            (profile ? (
              <SettingsTab profile={profile} onUpdate={fetchProfile} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {t("loadingSettings")}
              </div>
            ))}
        </div>

        {/* UID Display - Bottom Right */}
        {profile?.uid && (
          <div className="fixed bottom-4 right-4 bg-card text-muted-foreground px-3 py-1.5 rounded-lg text-sm font-mono border border-border">
            UID: {profile.uid}
          </div>
        )}
      </div>
    </div>
  );
}
