"use client";

import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Clock,
  BadgeCheck,
  Phone,
  Star,
  Eye,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import TrialRequestForm from "@/components/TrialRequestForm";
import { LessonDetailsModal } from "@/components/LessonDetailsModal";
import { useLessonTypes, LessonTypeData } from "@/lib/hooks/useLessonTypes";

const popularSlugs = ["1-to-2", "large-kids"];

function formatDuration(lesson: LessonTypeData): string {
  if (lesson.billingType === "monthly") {
    return `${lesson.sessionsPerMonth} sessions/month`;
  }
  if (lesson.pricingTiers.length === 0) return "";
  const durations = lesson.pricingTiers.map((t) => t.duration);
  if (durations.length === 1) {
    return `${durations[0]} hours`;
  }
  return `${durations[0]}-${durations[durations.length - 1]} hours`;
}

export default function LessonsPage() {
  const t = useTranslations("lessons");
  const { lessonTypes, loading, getLessonPrice, getPricePerPerson } =
    useLessonTypes();
  const [selectedLesson, setSelectedLesson] = useState<LessonTypeData | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const trialFormRef = useRef<HTMLDivElement>(null);

  const privateLessons = lessonTypes.filter(
    (lt) =>
      lt.billingType === "per_session" &&
      lt.maxStudents <= 4 &&
      lt.slug !== "small-adult-group",
  );
  const groupLessons = lessonTypes.filter(
    (lt) => lt.billingType === "monthly" || lt.slug === "small-adult-group",
  );

  const handleLessonClick = (lesson: LessonTypeData) => {
    setSelectedLesson(lesson);
    setModalOpen(true);
  };

  const handleRequestTrial = () => {
    trialFormRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getLessonLabel = (slug: string) => {
    return t(`types.${slug}`);
  };

  const renderLessonCard = (lesson: LessonTypeData) => {
    const isPopular = popularSlugs.includes(lesson.slug);
    const price = getLessonPrice(lesson.slug);
    const perPersonPrice = getPricePerPerson(lesson.slug);
    const isMonthly = lesson.billingType === "monthly";

    return (
      <Card
        key={lesson.slug}
        className={`relative bg-background border cursor-pointer hover-lift ${
          isPopular ? "border-primary" : "border-border"
        }`}
        onClick={() => handleLessonClick(lesson)}
      >
        {isPopular && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="bg-primary text-white">
              <Star className="w-3 h-3 mr-1" />
              {t("packages.popular")}
            </Badge>
          </div>
        )}
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold text-lg text-foreground">
                {getLessonLabel(lesson.slug)}
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                handleLessonClick(lesson);
              }}
            >
              <Eye className="w-4 h-4 mr-1" />
              {t("packages.viewDetails")}
            </Button>
          </div>

          <div className="mb-4">
            {perPersonPrice && lesson.maxStudents > 1 && !isMonthly ? (
              <div>
                <span className="text-3xl font-bold text-foreground">
                  RM{perPersonPrice}
                </span>
                <span className="text-muted-foreground text-sm">
                  {" "}
                  / {t("packages.perPerson")}
                </span>
                <div className="text-xs text-muted-foreground mt-1">
                  ({t("packages.total")}: RM{price})
                </div>
              </div>
            ) : (
              <div>
                <span className="text-3xl font-bold text-foreground">
                  RM{price}
                </span>
                <span className="text-muted-foreground text-sm">
                  {" "}
                  /{" "}
                  {isMonthly
                    ? t("packages.perMonth")
                    : t("packages.perSession")}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              {formatDuration(lesson)}
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              {lesson.maxStudents === 1
                ? t("packages.student")
                : t("packages.maxStudents", { count: lesson.maxStudents })}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const lessonsJsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: "Badminton Coaching at TZH Sports Centre",
    description:
      "BAM-certified badminton coaching for all levels. Private and group sessions available in Ayer Itam, Penang.",
    provider: {
      "@type": "SportsActivityLocation",
      name: "TZH Sports Centre",
      url: "https://tzh-sports-centre.vercel.app",
    },
    hasCourseInstance: [
      {
        "@type": "CourseInstance",
        name: "Private 1-to-1 Coaching",
        courseMode: "onsite",
        offers: { "@type": "Offer", price: "130", priceCurrency: "MYR" },
      },
      {
        "@type": "CourseInstance",
        name: "Group Kids Class (monthly)",
        courseMode: "onsite",
        offers: { "@type": "Offer", price: "50", priceCurrency: "MYR" },
      },
    ],
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(lessonsJsonLd) }}
      />
      {/* Hero Section */}
      <section className="pt-32 pb-16 md:pt-40 md:pb-24 bg-background relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="max-w-xl">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-forwards">
                {t("coach.certification")}
              </p>
              <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold text-foreground tracking-tight leading-[1.1] mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 fill-mode-forwards">
                {t("title")}
              </h1>
              <p className="text-xl text-muted-foreground mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-forwards">
                {t("subtitle")}
              </p>
              <a
                href="https://wa.me/601175758508"
                target="_blank"
                rel="noopener noreferrer"
                className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-forwards inline-block"
              >
                <Button
                  size="lg"
                  className="bg-primary text-white hover:bg-primary/90 rounded-full h-12 px-6"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  WhatsApp
                </Button>
              </a>
            </div>
            <div className="relative animate-in fade-in zoom-in-95 duration-1000 delay-200 fill-mode-forwards">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src="/images/lessons-hero.jpg"
                  alt="Professional badminton coaching"
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#202219]/60 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Open Enrollment CTA */}
      <section className="py-10 bg-primary/5 border-y border-primary/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              🎓 Open Enrollment Sessions
            </h2>
            <p className="text-muted-foreground mt-1">
              Browse available group sessions and join with a one-time payment — no commitment required.
            </p>
          </div>
          <Link href="/lessons/open">
            <Button className="bg-primary hover:bg-primary/90 text-white rounded-full whitespace-nowrap">
              Browse Open Sessions
            </Button>
          </Link>
        </div>
      </section>

      {/* Private Lesson Packages */}
      <section className="py-16 md:py-24 bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-4">
              {t("packages.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("packages.privateSubtitle")}
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {privateLessons.map((lesson) => renderLessonCard(lesson))}
            </div>
          )}
        </div>
      </section>

      {/* Group Lesson Packages */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-4">
              {t("packages.groupTitle")}
            </h2>
            <p className="text-muted-foreground">
              {t("packages.groupSubtitle")}
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {groupLessons.map((lesson) => renderLessonCard(lesson))}
            </div>
          )}
        </div>
      </section>

      {/* Coach Credentials */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="relative w-48 h-48 mx-auto mb-8 animate-in fade-in zoom-in-95 duration-700 fill-mode-forwards">
              <div className="relative w-full h-full rounded-full overflow-hidden border-4 border-primary/30 shadow-xl">
                <Image
                  src="/images/coach-teaching.jpg"
                  alt="Professional badminton coach"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-lg">
                <BadgeCheck className="w-6 h-6 text-white" />
              </div>
            </div>

            <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-4 animate-in fade-in duration-700 fill-mode-forwards">
              {t("coach.title")}
            </h2>
            <p className="text-muted-foreground text-lg mb-8 animate-in fade-in duration-700 delay-100 fill-mode-forwards">
              {t("coach.bio")}
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
              <div className="flex items-center gap-3 bg-background border border-border px-6 py-4 rounded-2xl hover-lift animate-in fade-in slide-in-from-left-4 duration-500 delay-200 fill-mode-forwards">
                <BadgeCheck className="w-8 h-8 text-muted-foreground" />
                <div className="text-left">
                  <p className="font-semibold text-foreground">
                    {t("coach.certification")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("coach.bam")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-background border border-border px-6 py-4 rounded-2xl hover-lift animate-in fade-in slide-in-from-right-4 duration-500 delay-200 fill-mode-forwards">
                <Users className="w-8 h-8 text-muted-foreground" />
                <div className="text-left">
                  <p className="font-semibold text-foreground">
                    {t("coach.experienceYears")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("coach.experienceDesc")}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleRequestTrial()}
              className="mt-8 inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-full font-medium hover:bg-primary/90 transition-colors animate-in fade-in duration-500 delay-300 fill-mode-forwards"
            >
              {t("coach.bookTrial")}
            </button>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-16 md:py-24 bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="bg-background border border-border hover-lift animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-forwards">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-card rounded-full flex items-center justify-center mx-auto mb-4">
                  <BadgeCheck className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-2">
                  {t("features.courtBooking.title")}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t("features.courtBooking.description")}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-background border border-border hover-lift animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-forwards">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-card rounded-full flex items-center justify-center mx-auto mb-4">
                  <BadgeCheck className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-2">
                  {t("features.shuttlecocks.title")}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t("features.shuttlecocks.description")}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-background border border-border hover-lift animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-forwards">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-card rounded-full flex items-center justify-center mx-auto mb-4">
                  <BadgeCheck className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-2">
                  {t("features.trial.title")}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t("features.trial.description")}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Trial Request Form */}
      <section className="py-16 md:py-24" id="trial-form" ref={trialFormRef}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <TrialRequestForm />
        </div>
      </section>

      {/* Lesson Details Modal */}
      <LessonDetailsModal
        lesson={selectedLesson}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onRequestTrial={handleRequestTrial}
      />
    </div>
  );
}
