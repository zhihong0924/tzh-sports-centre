import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import {
  Shield,
  Calendar,
  Users,
  Wrench,
  ShoppingBag,
  ArrowRight,
  CalendarX2,
  GraduationCap,
  Trophy,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function AdminPage() {
  const session = await auth();
  const t = await getTranslations("admin");

  if (!session?.user) {
    redirect("/auth/login?callbackUrl=/admin");
  }

  if (!isAdmin(session.user.email, session.user.isAdmin)) {
    redirect("/");
  }

  const adminFeatures = [
    {
      titleKey: "bookingsLessons.title",
      descriptionKey: "bookingsLessons.description",
      icon: Calendar,
      href: "/admin/bookings-lessons",
      iconBg: "bg-primary/10 text-primary",
    },
    {
      titleKey: "membersAccounts.title",
      descriptionKey: "membersAccounts.description",
      icon: Users,
      href: "/admin/members-accounts",
      iconBg: "bg-primary/15 text-primary",
    },
    {
      titleKey: "trainingOrders.title",
      descriptionKey: "trainingOrders.description",
      icon: Wrench,
      href: "/admin/stringing",
      iconBg: "bg-primary/10 text-primary",
    },
    {
      titleKey: "shopInventory.title",
      descriptionKey: "shopInventory.description",
      icon: ShoppingBag,
      href: "/admin/shop",
      iconBg: "bg-primary/15 text-primary",
    },
    {
      titleKey: "absences.title",
      descriptionKey: "absences.description",
      icon: CalendarX2,
      href: "/admin/absences",
      iconBg: "bg-primary/10 text-primary",
    },
    {
      titleKey: "staff.title",
      descriptionKey: "staff.description",
      icon: GraduationCap,
      href: "/admin/staff",
      iconBg: "bg-primary/15 text-primary",
    },
    {
      titleKey: "leaderboard.title",
      descriptionKey: "leaderboard.description",
      icon: Trophy,
      href: "/admin/leaderboard",
      iconBg: "bg-primary/10 text-primary",
    },
    {
      titleKey: "lessonTypes.title",
      descriptionKey: "lessonTypes.description",
      icon: BookOpen,
      href: "/admin/lesson-types",
      iconBg: "bg-primary/15 text-primary",
    },
    // Video subscriptions hidden - not complete yet
    // {
    //   titleKey: "videoSubscriptions.title",
    //   descriptionKey: "videoSubscriptions.description",
    //   icon: Video,
    //   href: "/admin/video-subscriptions",
    //   iconBg: "bg-primary/15 text-primary",
    // },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-12">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Shield className="w-4 h-4" />
            Admin Panel
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {t("welcome", { name: session.user.name || "" })}
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your sports centre from here.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {adminFeatures.map((feature) => (
            <Link key={feature.href} href={feature.href} className="group">
              <div className="relative flex items-start gap-4 p-6 h-full rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${feature.iconBg}`}
                >
                  <feature.icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    {t(feature.titleKey)}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {t(feature.descriptionKey)}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1 shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
