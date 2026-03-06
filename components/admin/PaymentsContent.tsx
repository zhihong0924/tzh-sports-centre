"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Phone,
  User,
  Check,
  Receipt,
  DollarSign,
  Clock,
  RefreshCw,
  FileText,
  Banknote,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  CheckSquare,
  Mail,
  AlertCircle,
  Zap,
  ListFilter,
} from "lucide-react";
import { isAdmin } from "@/lib/admin";
import { OutstandingDebtsView } from "@/components/admin/OutstandingDebtsView";
import { ReceiptReviewDialog } from "@/components/admin/ReceiptReviewDialog";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface PaymentTransaction {
  id: string;
  amount: number;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  recordedBy: string;
  recordedAt: string;
  verificationStatus?: string | null;
  receiptUrl?: string | null;
}

interface UserSummary {
  userId: string;
  uid: string;
  name: string;
  email: string;
  phone: string;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  totalHours: number;
  bookingsCount: number;
  regularBookings: number;
  recurringBookings: number;
  lessonAmount: number;
  lessonCount: number;
  status: "unpaid" | "partial" | "paid" | "no-bookings";
  paymentId: string | null;
  transactions: PaymentTransaction[];
}

interface BreakdownItem {
  type: "booking" | "recurring" | "lesson";
  date: string;
  court: string;
  sport: string;
  time: string;
  hours: number;
  rate: number;
  amount: number;
  bookingId?: string;
  recurringId?: string;
  lessonSessionId?: string;
  billingType?: string;
  attended?: boolean;
}

interface Totals {
  totalDue: number;
  totalPaid: number;
  totalUnpaid: number;
  usersCount: number;
  paidCount: number;
  partialCount: number;
  unpaidCount: number;
}

export default function PaymentsContent() {
  const { data: session, status } = useSession();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(),
  );

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [breakdownDialogOpen, setBreakdownDialogOpen] = useState(false);
  const [breakdownUser, setBreakdownUser] = useState<UserSummary | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  const [bulkPayDialogOpen, setBulkPayDialogOpen] = useState(false);
  const [bulkPaymentMethod, setBulkPaymentMethod] = useState<string>("cash");
  const [bulkReference, setBulkReference] = useState("");
  const [bulkNotes, setBulkNotes] = useState("");

  const [showOutstanding, setShowOutstanding] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);

  const [receiptReviewOpen, setReceiptReviewOpen] = useState(false);
  const [pendingReceipt, setPendingReceipt] = useState<{
    transactionId: string;
    userId: string;
    userName: string;
    month: number;
    year: number;
    amount: number;
    paymentMethod: string;
    receiptUrl: string;
    notes: string | null;
  } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/monthly-payments?month=${selectedMonth}&year=${selectedYear}`,
      );
      const data = await res.json();

      if (res.ok) {
        setUsers(data.users || []);
        setTotals(data.totals || null);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (session?.user && isAdmin(session.user.email, session.user.isAdmin)) {
      fetchData();
    }
  }, [session, fetchData]);

  const fetchBreakdown = async (user: UserSummary) => {
    setBreakdownUser(user);
    setBreakdownDialogOpen(true);
    setBreakdownLoading(true);

    try {
      const res = await fetch(
        `/api/admin/monthly-payments?userId=${user.userId}&month=${selectedMonth}&year=${selectedYear}`,
      );
      const data = await res.json();
      if (res.ok) {
        setBreakdown(data.breakdown || []);
      }
    } catch (error) {
      console.error("Error fetching breakdown:", error);
    } finally {
      setBreakdownLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedUser) return;

    const amount = parseFloat(paymentAmount) || selectedUser.unpaidAmount;
    if (amount <= 0) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/monthly-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.userId,
          month: selectedMonth,
          year: selectedYear,
          amount,
          paymentMethod,
          reference: paymentReference || null,
          notes: paymentNotes || null,
        }),
      });

      if (res.ok) {
        setPaymentDialogOpen(false);
        resetPaymentForm();
        fetchData();
      }
    } catch (error) {
      console.error("Error recording payment:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkMarkPaid = async () => {
    if (selectedUserIds.size === 0) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/monthly-payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: Array.from(selectedUserIds),
          month: selectedMonth,
          year: selectedYear,
          paymentMethod: bulkPaymentMethod,
          reference: bulkReference || null,
          notes: bulkNotes || null,
        }),
      });

      if (res.ok) {
        setBulkPayDialogOpen(false);
        setBulkPaymentMethod("cash");
        setBulkReference("");
        setBulkNotes("");
        setSelectedUserIds(new Set());
        fetchData();
      }
    } catch (error) {
      console.error("Error bulk marking paid:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = [
      "UID",
      "Name",
      "Email",
      "Phone",
      "Bookings",
      "Lessons",
      "Lesson Amount",
      "Hours",
      "Total Due",
      "Paid",
      "Unpaid",
      "Status",
    ];
    const rows = users.map((u) => [
      u.uid,
      u.name,
      u.email,
      u.phone,
      u.bookingsCount,
      u.lessonCount || 0,
      (u.lessonAmount || 0).toFixed(2),
      u.totalHours.toFixed(1),
      u.totalAmount.toFixed(2),
      u.paidAmount.toFixed(2),
      u.unpaidAmount.toFixed(2),
      u.status,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monthly-payments-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetPaymentForm = () => {
    setSelectedUser(null);
    setPaymentMethod("cash");
    setPaymentAmount("");
    setPaymentReference("");
    setPaymentNotes("");
  };

  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUserIds(newSet);
  };

  const selectAllUnpaid = () => {
    const unpaidIds = users
      .filter((u) => u.status !== "paid")
      .map((u) => u.userId);
    setSelectedUserIds(new Set(unpaidIds));
  };

  const clearSelection = () => {
    setSelectedUserIds(new Set());
  };

  const handleOutstandingRecordPayment = (
    userId: string,
    name: string,
    uid: string,
    month: number,
    year: number,
    totalAmount: number,
    paidAmount: number,
    unpaidAmount: number,
  ) => {
    const syntheticUser: UserSummary = {
      userId,
      uid,
      name,
      email: "",
      phone: "",
      totalAmount,
      paidAmount,
      unpaidAmount,
      totalHours: 0,
      bookingsCount: 0,
      regularBookings: 0,
      recurringBookings: 0,
      lessonAmount: 0,
      lessonCount: 0,
      status: paidAmount === 0 ? "unpaid" : "partial",
      paymentId: null,
      transactions: [],
    };
    setSelectedMonth(month);
    setSelectedYear(year);
    setSelectedUser(syntheticUser);
    setPaymentAmount(unpaidAmount.toFixed(2));
    setShowOutstanding(false);
    setPaymentDialogOpen(true);
  };

  const handleGenerateBills = async () => {
    setGenerateLoading(true);
    try {
      const res = await fetch("/api/admin/billing/generate-month", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth, year: selectedYear }),
      });
      const data = await res.json();
      if (res.ok) {
        setGenerateDialogOpen(false);
        fetchData();
        alert(`Generated bills for ${data.generated} users (${data.skipped} skipped)`);
      }
    } catch (error) {
      console.error("Error generating bills:", error);
    } finally {
      setGenerateLoading(false);
    }
  };

  const openReceiptReview = (user: UserSummary) => {
    const pending = user.transactions.find(
      (tx) => tx.verificationStatus === "pending_verification" && tx.receiptUrl,
    );
    if (!pending || !pending.receiptUrl) return;
    setPendingReceipt({
      transactionId: pending.id,
      userId: user.userId,
      userName: user.name,
      month: selectedMonth,
      year: selectedYear,
      amount: pending.amount,
      paymentMethod: pending.paymentMethod,
      receiptUrl: pending.receiptUrl,
      notes: pending.notes,
    });
    setReceiptReviewOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-green-100 text-green-700 border-0">
            <Check className="w-3 h-3 mr-1" />
            Paid
          </Badge>
        );
      case "partial":
        return (
          <Badge className="bg-amber-100 text-amber-700 border-0">
            <Banknote className="w-3 h-3 mr-1" />
            Partial
          </Badge>
        );
      case "unpaid":
        return (
          <Badge className="bg-red-100 text-red-600 border-0">
            <Clock className="w-3 h-3 mr-1" />
            Unpaid
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
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
      {/* Header Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button
          onClick={() => setShowOutstanding((v) => !v)}
          variant={showOutstanding ? "default" : "outline"}
          size="sm"
        >
          <ListFilter className="w-4 h-4 mr-2" />
          {showOutstanding ? "Monthly View" : "All Unpaid"}
        </Button>
        <Button onClick={exportCSV} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Outstanding debts view */}
      {showOutstanding && (
        <OutstandingDebtsView
          onRecordPayment={handleOutstandingRecordPayment}
          onGenerateBills={() => setGenerateDialogOpen(true)}
        />
      )}

      {/* Month Navigator */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-4">
              <Select
                value={selectedMonth.toString()}
                onValueChange={(val) => setSelectedMonth(parseInt(val))}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, idx) => (
                    <SelectItem key={idx} value={(idx + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedYear.toString()}
                onValueChange={(val) => setSelectedYear(parseInt(val))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={goToNextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/30 rounded-lg">
                  <User className="w-5 h-5 text-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Customers</p>
                  <p className="text-xl font-bold">{totals.usersCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Check className="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="text-xl font-bold text-green-700">
                    {totals.paidCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Clock className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unpaid</p>
                  <p className="text-xl font-bold text-red-600">
                    {totals.unpaidCount + totals.partialCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-purple-700" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Collected</p>
                  <p className="text-xl font-bold">
                    RM{totals.totalPaid.toFixed(0)}
                    <span className="text-sm text-muted-foreground/70">
                      /{totals.totalDue.toFixed(0)}
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedUserIds.size > 0 && (
        <Card className="bg-primary/30 border-border">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">
                {selectedUserIds.size} customer(s) selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setBulkPayDialogOpen(true)}
                >
                  <CheckSquare className="w-4 h-4 mr-1" />
                  Mark Selected Paid
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {MONTHS[selectedMonth - 1]} {selectedYear}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={selectAllUnpaid}>
              Select All Unpaid
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/70" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No bookings found for this month
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.userId}
                  className={`p-4 rounded-lg border ${
                    user.status === "paid"
                      ? "bg-green-50 border-green-200"
                      : user.status === "partial"
                        ? "bg-amber-50 border-yellow-200"
                        : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    {user.status !== "paid" && (
                      <Checkbox
                        checked={selectedUserIds.has(user.userId)}
                        onCheckedChange={() => toggleUserSelection(user.userId)}
                        className="mt-1"
                      />
                    )}

                    {/* User Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{user.name}</span>
                        <Badge variant="outline" className="font-mono text-xs">
                          UID: {user.uid}
                        </Badge>
                        {getStatusBadge(user.status)}
                      </div>

                      <div className="text-sm text-muted-foreground mt-2 space-y-1">
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {user.phone}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Receipt className="w-3 h-3" />
                            {user.bookingsCount} bookings (
                            {user.regularBookings} one-time,{" "}
                            {user.recurringBookings} recurring)
                            {user.lessonCount > 0 &&
                              `, ${user.lessonCount} lessons`}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {user.totalHours.toFixed(1)} hours
                          </span>
                        </div>
                      </div>

                      {/* Payment info */}
                      <div className="mt-3 flex items-center gap-6">
                        <div>
                          <span className="text-sm text-muted-foreground">
                            Total Due:{" "}
                          </span>
                          <span className="font-bold">
                            RM{user.totalAmount.toFixed(2)}
                          </span>
                        </div>
                        {user.paidAmount > 0 && (
                          <div>
                            <span className="text-sm text-muted-foreground">
                              Paid:{" "}
                            </span>
                            <span className="font-bold text-green-700">
                              RM{user.paidAmount.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {user.unpaidAmount > 0 && (
                          <div>
                            <span className="text-sm text-muted-foreground">
                              Unpaid:{" "}
                            </span>
                            <span className="font-bold text-red-600">
                              RM{user.unpaidAmount.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Recent transactions */}
                      {user.transactions.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Last payment: RM
                          {user.transactions[
                            user.transactions.length - 1
                          ].amount.toFixed(2)}{" "}
                          via{" "}
                          {
                            user.transactions[user.transactions.length - 1]
                              .paymentMethod
                          }{" "}
                          on{" "}
                          {format(
                            new Date(
                              user.transactions[user.transactions.length - 1]
                                .recordedAt,
                            ),
                            "dd MMM yyyy",
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 items-end">
                      {user.transactions.some(
                        (tx) => tx.verificationStatus === "pending_verification",
                      ) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-400 text-amber-600 hover:bg-amber-50"
                          onClick={() => openReceiptReview(user)}
                        >
                          <AlertCircle className="w-4 h-4 mr-1" />
                          Review Receipt
                        </Button>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => fetchBreakdown(user)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        {user.status !== "paid" && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => {
                              setSelectedUser(user);
                              setPaymentAmount(user.unpaidAmount.toFixed(2));
                              setPaymentDialogOpen(true);
                            }}
                          >
                            <CreditCard className="w-4 h-4 mr-1" />
                            Pay
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog
        open={paymentDialogOpen}
        onOpenChange={(open) => {
          setPaymentDialogOpen(open);
          if (!open) resetPaymentForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CreditCard className="w-5 h-5" />
              Record Payment
            </DialogTitle>
            <DialogDescription>
              Record a payment for {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="py-4 space-y-4">
              <div className="p-3 bg-secondary rounded-lg space-y-1">
                <p>
                  <strong>Customer:</strong> {selectedUser.name} (UID:{" "}
                  {selectedUser.uid})
                </p>
                <p>
                  <strong>Total Due:</strong> RM
                  {selectedUser.totalAmount.toFixed(2)}
                </p>
                <p>
                  <strong>Already Paid:</strong> RM
                  {selectedUser.paidAmount.toFixed(2)}
                </p>
                <p className="text-lg font-bold text-red-600">
                  <strong>Remaining:</strong> RM
                  {selectedUser.unpaidAmount.toFixed(2)}
                </p>
              </div>

              <div>
                <Label>Payment Amount (RM)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={selectedUser.unpaidAmount.toFixed(2)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty or enter full amount for complete payment
                </p>
              </div>

              <div>
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="tng">Touch &apos;n Go</SelectItem>
                    <SelectItem value="duitnow">DuitNow</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Reference Number (Optional)</Label>
                <Input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Transaction ID or reference"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Notes (Optional)</Label>
                <Input
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Any notes about this payment"
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPaymentDialogOpen(false);
                resetPaymentForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Breakdown Dialog */}
      <Dialog open={breakdownDialogOpen} onOpenChange={setBreakdownDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Booking Breakdown - {breakdownUser?.name}
            </DialogTitle>
            <DialogDescription>
              All bookings for {MONTHS[selectedMonth - 1]} {selectedYear}
            </DialogDescription>
          </DialogHeader>

          {breakdownLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/70" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-secondary rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Bookings
                  </p>
                  <p className="text-xl font-bold">{breakdown.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="text-xl font-bold">
                    {breakdown.reduce((s, b) => s + b.hours, 0).toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-xl font-bold">
                    RM{breakdown.reduce((s, b) => s + b.amount, 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Breakdown table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Court</th>
                      <th className="px-3 py-2 text-left">Time</th>
                      <th className="px-3 py-2 text-right">Hours</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((item, idx) => (
                      <tr key={idx} className="border-t border-border">
                        <td className="px-3 py-2">
                          {format(new Date(item.date), "dd MMM")}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className={
                              item.type === "lesson"
                                ? "bg-orange-50 text-orange-700"
                                : item.type === "recurring"
                                  ? "bg-purple-50 text-purple-700"
                                  : "bg-primary/30 text-foreground"
                            }
                          >
                            {item.type === "lesson"
                              ? "Lesson"
                              : item.type === "recurring"
                                ? "Recurring"
                                : "One-time"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">{item.court}</td>
                        <td className="px-3 py-2">{item.time}</td>
                        <td className="px-3 py-2 text-right">{item.hours}</td>
                        <td className="px-3 py-2 text-right">
                          RM{item.rate.toFixed(0)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {item.type === "lesson" &&
                          !item.attended &&
                          item.billingType !== "monthly" ? (
                            <span className="line-through text-muted-foreground">
                              RM
                              {item.rate * item.hours > 0
                                ? (item.rate * item.hours).toFixed(2)
                                : "0.00"}{" "}
                              <span className="text-xs">(absent)</span>
                            </span>
                          ) : (
                            <>RM{item.amount.toFixed(2)}</>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-secondary font-bold">
                    <tr>
                      <td colSpan={4} className="px-3 py-2">
                        Total
                      </td>
                      <td className="px-3 py-2 text-right">
                        {breakdown.reduce((s, b) => s + b.hours, 0).toFixed(1)}
                      </td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right">
                        RM
                        {breakdown.reduce((s, b) => s + b.amount, 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Generate Bills Confirmation Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Generate Monthly Bills
            </DialogTitle>
            <DialogDescription>
              Generate recurring booking bills for {MONTHS[selectedMonth - 1]} {selectedYear}.
              Users with active recurring bookings will receive a bill and notification.
              Already paid/partial records will be skipped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateBills}
              disabled={generateLoading}
              className="bg-primary hover:bg-primary/90"
            >
              {generateLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Generate Bills
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Review Dialog */}
      <ReceiptReviewDialog
        open={receiptReviewOpen}
        onOpenChange={setReceiptReviewOpen}
        receipt={pendingReceipt}
        onSuccess={() => {
          setPendingReceipt(null);
          fetchData();
        }}
      />

      {/* Bulk Payment Dialog */}
      <Dialog open={bulkPayDialogOpen} onOpenChange={setBulkPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckSquare className="w-5 h-5" />
              Bulk Mark Paid
            </DialogTitle>
            <DialogDescription>
              Mark {selectedUserIds.size} customer(s) as fully paid
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="p-3 bg-primary/30 rounded-lg">
              <p className="font-medium">Selected Customers:</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                {users
                  .filter((u) => selectedUserIds.has(u.userId))
                  .map((u) => (
                    <li key={u.userId}>
                      {u.name} - RM{u.unpaidAmount.toFixed(2)}
                    </li>
                  ))}
              </ul>
              <p className="mt-3 font-bold">
                Total: RM
                {users
                  .filter((u) => selectedUserIds.has(u.userId))
                  .reduce((sum, u) => sum + u.unpaidAmount, 0)
                  .toFixed(2)}
              </p>
            </div>

            <div>
              <Label>Payment Method</Label>
              <Select
                value={bulkPaymentMethod}
                onValueChange={setBulkPaymentMethod}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="tng">Touch &apos;n Go</SelectItem>
                  <SelectItem value="duitnow">DuitNow</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reference Number (Optional)</Label>
              <Input
                value={bulkReference}
                onChange={(e) => setBulkReference(e.target.value)}
                placeholder="Transaction ID or reference"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <Input
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                placeholder="Any notes about this bulk payment"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkPayDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkMarkPaid}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Mark All Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
