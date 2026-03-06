"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Phone,
  List,
  Grid3X3,
  Zap,
} from "lucide-react";

interface MonthEntry {
  month: number;
  year: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  status: string;
  paymentId: string;
}

interface OutstandingUser {
  userId: string;
  uid: string;
  name: string;
  email: string;
  phone: string | null;
  totalOwed: number;
  months: MonthEntry[];
}

interface OutstandingData {
  users: OutstandingUser[];
  matrixMonths: string[];
  total: number;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatMonthKey(key: string) {
  const [y, m] = key.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "paid")
    return <Badge className="bg-green-600 text-white text-xs">Paid</Badge>;
  if (status === "partial")
    return <Badge className="bg-amber-500 text-white text-xs">Partial</Badge>;
  return <Badge className="bg-red-600 text-white text-xs">Unpaid</Badge>;
}

interface OutstandingDebtsViewProps {
  onRecordPayment: (
    userId: string,
    name: string,
    uid: string,
    month: number,
    year: number,
    totalAmount: number,
    paidAmount: number,
    unpaidAmount: number,
  ) => void;
  onGenerateBills?: () => void;
}

export function OutstandingDebtsView({
  onRecordPayment,
  onGenerateBills,
}: OutstandingDebtsViewProps) {
  const [data, setData] = useState<OutstandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "matrix">("list");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/admin/monthly-payments/outstanding")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = (userId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (!data || data.users.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No outstanding debts found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.total} user{data.total !== 1 ? "s" : ""} with outstanding
          balances
        </p>
        <div className="flex gap-1">
          {onGenerateBills && (
            <Button size="sm" variant="outline" onClick={onGenerateBills}>
              <Zap className="w-4 h-4 mr-1" />
              Generate Bills
            </Button>
          )}
          <Button
            size="sm"
            variant={view === "list" ? "default" : "outline"}
            onClick={() => setView("list")}
          >
            <List className="w-4 h-4 mr-1" />
            List
          </Button>
          <Button
            size="sm"
            variant={view === "matrix" ? "default" : "outline"}
            onClick={() => setView("matrix")}
          >
            <Grid3X3 className="w-4 h-4 mr-1" />
            Matrix
          </Button>
        </div>
      </div>

      {view === "list" && (
        <div className="space-y-2">
          {data.users.map((user) => (
            <Card key={user.userId} className="border border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">
                        {user.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        #{user.uid}
                      </span>
                      {user.phone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {user.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-red-600">
                      RM{user.totalOwed.toFixed(2)}
                    </span>
                    <button
                      onClick={() => toggleExpand(user.userId)}
                      className="p-1 hover:bg-muted rounded"
                    >
                      {expanded.has(user.userId) ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {expanded.has(user.userId) && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    {user.months.map((m) => (
                      <div
                        key={`${m.year}-${m.month}`}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-foreground">
                            {MONTH_NAMES[m.month - 1]} {m.year}
                          </span>
                          <StatusBadge status={m.status} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            RM{m.unpaidAmount.toFixed(2)} owed
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              onRecordPayment(
                                user.userId,
                                user.name,
                                user.uid,
                                m.month,
                                m.year,
                                m.totalAmount,
                                m.paidAmount,
                                m.unpaidAmount,
                              )
                            }
                          >
                            Record
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {view === "matrix" && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium sticky left-0 bg-card">
                    Student
                  </th>
                  {data.matrixMonths.map((mk) => (
                    <th
                      key={mk}
                      className="text-center px-3 py-2 text-muted-foreground font-medium whitespace-nowrap"
                    >
                      {formatMonthKey(mk)}
                    </th>
                  ))}
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => {
                  const byMonthKey = new Map(
                    user.months.map((m) => [
                      `${m.year}-${String(m.month).padStart(2, "0")}`,
                      m,
                    ]),
                  );
                  return (
                    <tr
                      key={user.userId}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-2 sticky left-0 bg-card">
                        <span className="font-medium text-foreground">
                          {user.name}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          #{user.uid}
                        </span>
                      </td>
                      {data.matrixMonths.map((mk) => {
                        const entry = byMonthKey.get(mk);
                        if (!entry)
                          return (
                            <td key={mk} className="px-3 py-2 text-center">
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            </td>
                          );
                        const bg =
                          entry.status === "paid"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                            : entry.status === "partial"
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
                              : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200";
                        return (
                          <td key={mk} className="px-3 py-2 text-center">
                            <button
                              onClick={() =>
                                onRecordPayment(
                                  user.userId,
                                  user.name,
                                  user.uid,
                                  entry.month,
                                  entry.year,
                                  entry.totalAmount,
                                  entry.paidAmount,
                                  entry.unpaidAmount,
                                )
                              }
                              className={`text-xs px-2 py-1 rounded font-medium ${bg}`}
                            >
                              RM{entry.unpaidAmount.toFixed(0)}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 text-right font-bold text-red-600">
                        RM{user.totalOwed.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
