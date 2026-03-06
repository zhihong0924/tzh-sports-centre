"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, CheckCircle, Receipt } from "lucide-react";
import { useTranslations } from "next-intl";

interface BillingSummary {
  unpaidAmount: number;
  status: string;
}

interface StatsCardsProps {
  upcomingCount: number;
  pendingCount: number;
  completedCount: number;
  billing?: BillingSummary | null;
}

export function StatsCards({
  upcomingCount,
  pendingCount,
  completedCount,
  billing,
}: StatsCardsProps) {
  const t = useTranslations("member.stats");
  const router = useRouter();

  const billingColor =
    billing == null
      ? "text-muted-foreground"
      : billing.status === "paid" || billing.unpaidAmount === 0
        ? "text-green-600"
        : billing.status === "partial"
          ? "text-amber-600"
          : "text-red-600";

  const billingBg =
    billing == null
      ? "bg-secondary"
      : billing.status === "paid" || billing.unpaidAmount === 0
        ? "bg-green-100 dark:bg-green-900/30"
        : billing.status === "partial"
          ? "bg-amber-100 dark:bg-amber-900/30"
          : "bg-red-100 dark:bg-red-900/30";

  const billingDisplay =
    billing == null
      ? "—"
      : billing.unpaidAmount === 0
        ? "RM0"
        : `RM${billing.unpaidAmount.toFixed(2)}`;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card className="border border-border rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {upcomingCount}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("upcomingLessons")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border border-border rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {pendingCount}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("pendingRequests")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border border-border rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {completedCount}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("completedLessons")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card
        className="border border-border rounded-2xl cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => router.push("/profile?tab=billing")}
      >
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${billingBg}`}
            >
              <Receipt className={`w-5 h-5 ${billingColor}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${billingColor}`}>
                {billingDisplay}
              </p>
              <p className="text-sm text-muted-foreground">{t("balanceDue")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
