"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, ExternalLink } from "lucide-react";

interface PendingReceipt {
  transactionId: string;
  userId: string;
  userName: string;
  month: number;
  year: number;
  amount: number;
  paymentMethod: string;
  receiptUrl: string;
  notes: string | null;
}

interface ReceiptReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: PendingReceipt | null;
  onSuccess: () => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const METHOD_LABELS: Record<string, string> = {
  tng: "Touch 'n Go",
  duitnow: "DuitNow",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
};

export function ReceiptReviewDialog({
  open,
  onOpenChange,
  receipt,
  onSuccess,
}: ReceiptReviewDialogProps) {
  const [approveAmount, setApproveAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: "approve" | "reject") => {
    if (!receipt) return;
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { transactionId: receipt.transactionId, action };
      if (action === "approve" && approveAmount) {
        body.amount = parseFloat(approveAmount);
      }

      const res = await fetch("/api/admin/billing/verify-receipt", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!receipt) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review Payment Receipt</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Receipt info */}
          <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Student</span>
              <span className="font-medium">{receipt.userName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Month</span>
              <span>{MONTH_NAMES[receipt.month - 1]} {receipt.year}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Method</span>
              <span>{METHOD_LABELS[receipt.paymentMethod] || receipt.paymentMethod}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount claimed</span>
              <span className="font-bold text-foreground">RM{receipt.amount.toFixed(2)}</span>
            </div>
            {receipt.notes && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notes</span>
                <span className="text-right max-w-[60%]">{receipt.notes}</span>
              </div>
            )}
          </div>

          {/* Receipt image */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Receipt Image</Label>
              <a
                href={receipt.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary flex items-center gap-1 hover:underline"
              >
                Open full size <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receipt.receiptUrl}
              alt="Payment receipt"
              className="w-full max-h-64 object-contain rounded-lg border border-border bg-muted"
            />
          </div>

          {/* Admin amount override */}
          <div>
            <Label>
              Approve Amount (RM){" "}
              <Badge variant="outline" className="text-xs ml-1">optional override</Badge>
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={approveAmount}
              onChange={(e) => setApproveAmount(e.target.value)}
              placeholder={`Default: ${receipt.amount.toFixed(2)}`}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave blank to approve the claimed amount of RM{receipt.amount.toFixed(2)}
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleAction("reject")}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
            Reject
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => handleAction("approve")}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
