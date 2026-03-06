"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Loader2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { BillingReceiptDialog } from "@/components/profile/BillingReceiptDialog";

interface BreakdownItem {
  type: "booking" | "recurring" | "lesson" | "shop";
  date: string;
  description: string;
  amount: number;
}

interface Transaction {
  id: string;
  amount: number;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  recordedAt: string;
  verificationStatus?: string | null;
}

interface BillingData {
  month: number;
  year: number;
  monthName: string;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  status: string;
  monthlyPaymentId: string | null;
  breakdown: BreakdownItem[];
  transactions: Transaction[];
  summary: {
    bookingTotal: number;
    recurringTotal: number;
    lessonTotal: number;
    shopTotal: number;
  };
}

interface UnpaidMonth {
  month: number;
  year: number;
  unpaidAmount: number;
  status: string;
}

interface BillingTabProps {
  onPayNow?: (
    month: number,
    year: number,
    amount: number,
    monthlyPaymentId: string | null,
  ) => void;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-600 text-white">Paid</Badge>;
    case "partial":
      return <Badge className="bg-amber-500 text-white">Partial</Badge>;
    case "unpaid":
      return <Badge className="bg-red-600 text-white">Unpaid</Badge>;
    default:
      return <Badge variant="outline">No Activity</Badge>;
  }
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    booking: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    recurring:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
    lesson:
      "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
    shop: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  };
  const labels: Record<string, string> = {
    booking: "Court",
    recurring: "Recurring",
    lesson: "Lesson",
    shop: "Shop",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded font-medium ${colors[type] || ""}`}
    >
      {labels[type] || type}
    </span>
  );
}

export function BillingTab({ onPayNow }: BillingTabProps) {
  const t = useTranslations("profile.billing");
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [unpaidMonths, setUnpaidMonths] = useState<UnpaidMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptContext, setReceiptContext] = useState<{
    month: number;
    year: number;
    unpaidAmount: number;
    monthlyPaymentId: string | null;
  } | null>(null);

  const fetchBilling = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [billingRes, unpaidRes] = await Promise.all([
        fetch(`/api/profile/billing?month=${month}&year=${year}`),
        fetch("/api/profile/billing?all_unpaid=true"),
      ]);
      if (billingRes.ok) {
        setBilling(await billingRes.json());
      } else {
        setError("Failed to load billing data");
      }
      if (unpaidRes.ok) {
        setUnpaidMonths(await unpaidRes.json());
      }
    } catch {
      setError("Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    const nextM = month === 12 ? 1 : month + 1;
    const nextY = month === 12 ? year + 1 : year;
    if (
      nextY > now.getFullYear() ||
      (nextY === now.getFullYear() && nextM > now.getMonth() + 1)
    )
      return;
    setMonth(nextM);
    if (month === 12) setYear((y) => y + 1);
  };

  const isCurrentMonth =
    month === now.getMonth() + 1 && year === now.getFullYear();

  const formatMonthName = (m: number, y: number) =>
    new Date(y, m - 1, 1).toLocaleString("en-MY", {
      month: "long",
      year: "numeric",
    });

  return (
    <div className="space-y-6">
      {/* Outstanding months alert */}
      {unpaidMonths.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-red-800 dark:text-red-200 text-sm">
                {t("outstandingAlert")}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {unpaidMonths.map((m) => (
                  <button
                    key={`${m.year}-${m.month}`}
                    onClick={() => {
                      setMonth(m.month);
                      setYear(m.year);
                    }}
                    className="text-xs text-red-700 dark:text-red-300 underline hover:no-underline"
                  >
                    {formatMonthName(m.month, m.year)} (RM
                    {m.unpaidAmount.toFixed(2)})
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Month selector */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-foreground">
          {formatMonthName(month, year)}
        </h2>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="text-center py-8 text-destructive text-sm">{error}</div>
      )}

      {!loading && !error && billing && (
        <>
          {/* Summary card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t("summary")}</CardTitle>
                <StatusBadge status={billing.status} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("totalDue")}
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    RM{billing.totalAmount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("paid")}
                  </p>
                  <p className="text-lg font-bold text-green-600">
                    RM{billing.paidAmount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("remaining")}
                  </p>
                  <p
                    className={`text-lg font-bold ${billing.unpaidAmount > 0 ? "text-red-600" : "text-green-600"}`}
                  >
                    RM{billing.unpaidAmount.toFixed(2)}
                  </p>
                </div>
              </div>

              {billing.unpaidAmount > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <Button
                    onClick={() => {
                      if (onPayNow) {
                        onPayNow(billing.month, billing.year, billing.unpaidAmount, billing.monthlyPaymentId);
                      } else {
                        setReceiptContext({
                          month: billing.month,
                          year: billing.year,
                          unpaidAmount: billing.unpaidAmount,
                          monthlyPaymentId: billing.monthlyPaymentId,
                        });
                        setReceiptDialogOpen(true);
                      }
                    }}
                    className="w-full bg-primary hover:bg-primary/90 text-white"
                  >
                    <Receipt className="w-4 h-4 mr-2" />
                    {t("payNow")} — RM{billing.unpaidAmount.toFixed(2)}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Breakdown table */}
          {billing.breakdown.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("breakdown")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-4 py-2 text-muted-foreground font-medium">
                          {t("date")}
                        </th>
                        <th className="text-left px-4 py-2 text-muted-foreground font-medium">
                          {t("type")}
                        </th>
                        <th className="text-left px-4 py-2 text-muted-foreground font-medium hidden sm:table-cell">
                          {t("description")}
                        </th>
                        <th className="text-right px-4 py-2 text-muted-foreground font-medium">
                          {t("amount")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {billing.breakdown.map((item, i) => (
                        <tr
                          key={i}
                          className="border-b border-border last:border-0 hover:bg-muted/50"
                        >
                          <td className="px-4 py-2 text-foreground">
                            {item.date}
                          </td>
                          <td className="px-4 py-2">
                            <TypeBadge type={item.type} />
                          </td>
                          <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">
                            {item.description}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-foreground">
                            RM{item.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border">
                        <td
                          colSpan={3}
                          className="px-4 py-2 font-semibold text-foreground"
                        >
                          {t("total")}
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-foreground">
                          RM{billing.totalAmount.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Receipt className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p>{t("noActivity")}</p>
              </CardContent>
            </Card>
          )}

          {/* Payment history */}
          {billing.transactions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t("paymentHistory")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {billing.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {tx.paymentMethod.toUpperCase()}
                          {tx.reference && (
                            <span className="text-muted-foreground font-normal ml-2">
                              #{tx.reference}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.recordedAt).toLocaleDateString("en-MY")}
                          {tx.notes && ` · ${tx.notes}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {tx.verificationStatus === "pending_verification" && (
                          <Badge
                            variant="outline"
                            className="text-xs border-amber-400 text-amber-600"
                          >
                            Pending
                          </Badge>
                        )}
                        {tx.verificationStatus === "rejected" && (
                          <Badge
                            variant="outline"
                            className="text-xs border-red-400 text-red-600"
                          >
                            Rejected
                          </Badge>
                        )}
                        <span className="font-semibold text-foreground text-sm">
                          RM{tx.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
      {receiptContext && (
        <BillingReceiptDialog
          open={receiptDialogOpen}
          onOpenChange={setReceiptDialogOpen}
          month={receiptContext.month}
          year={receiptContext.year}
          unpaidAmount={receiptContext.unpaidAmount}
          monthlyPaymentId={receiptContext.monthlyPaymentId}
          onSuccess={fetchBilling}
        />
      )}
    </div>
  );
}
