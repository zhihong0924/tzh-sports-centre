"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Clock,
  MapPin,
  CheckCircle2,
  Download,
  ImagePlus,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { format } from "date-fns";

interface EnrollmentPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId: string;
  lessonSessionId: string;
  amountDue: number;
  lessonDate: string;
  startTime: string;
  endTime: string;
  lessonType: string;
  courtName: string;
  onSuccess: () => void;
}

export function EnrollmentPaymentDialog({
  open,
  onOpenChange,
  lessonSessionId,
  amountDue,
  lessonDate,
  startTime,
  endTime,
  lessonType,
  courtName,
  onSuccess,
}: EnrollmentPaymentDialogProps) {
  const t = useTranslations("openLessons");
  const [paymentMethod, setPaymentMethod] = useState<"tng" | "duitnow">("tng");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReceiptSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload JPG, PNG, or WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 5MB.");
      return;
    }

    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setReceiptPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    setUploaded(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadQr = () => {
    const img =
      paymentMethod === "tng" ? "/images/tng-qr.png" : "/images/duitnow-qr.png";
    const link = document.createElement("a");
    link.href = img;
    link.download = `${paymentMethod}-qr.png`;
    link.click();
  };

  const handleSubmit = async () => {
    if (!receiptFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", receiptFile);

      const res = await fetch(
        `/api/lessons/${lessonSessionId}/enrollment-receipt`,
        { method: "POST", body: formData }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setUploaded(true);
      toast.success(t("receiptUploaded"));
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("receiptError"));
    } finally {
      setUploading(false);
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setReceiptFile(null);
      setReceiptPreview(null);
      setUploaded(false);
      setPaymentMethod("tng");
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("enrollDialogTitle")}</DialogTitle>
          <DialogDescription>{t("enrollDialogDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Lesson summary */}
          <div className="bg-secondary rounded-lg p-3 space-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-foreground">
              <CalendarDays className="w-4 h-4 text-primary shrink-0" />
              <span>{format(new Date(lessonDate), "EEE, d MMM yyyy")}</span>
            </div>
            <div className="flex items-center gap-2 text-foreground">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <span>{startTime} – {endTime}</span>
            </div>
            <div className="flex items-center gap-2 text-foreground">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span>{courtName}</span>
            </div>
            <Badge variant="secondary" className="text-xs">{lessonType}</Badge>
          </div>

          {/* Amount */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
            <p className="text-sm text-muted-foreground">{t("amountDue")}</p>
            <p className="text-3xl font-bold text-primary">
              RM{amountDue.toFixed(2)}
            </p>
          </div>

          {/* Payment instructions */}
          <p className="text-sm text-muted-foreground">{t("paymentInstructions")}</p>

          {/* Payment method selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setPaymentMethod("tng")}
              className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                paymentMethod === "tng"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              Touch &apos;n Go
            </button>
            <button
              onClick={() => setPaymentMethod("duitnow")}
              className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                paymentMethod === "duitnow"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              DuitNow
            </button>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-card rounded-lg border-2 border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  paymentMethod === "tng"
                    ? "/images/tng-qr.png"
                    : "/images/duitnow-qr.png"
                }
                alt={`${paymentMethod === "tng" ? "TnG" : "DuitNow"} QR Code`}
                className="w-48 h-48 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <Button variant="outline" className="w-full" onClick={downloadQr}>
              <Download className="mr-2 h-4 w-4" />
              Save QR Code
            </Button>
          </div>

          {/* Upload Receipt */}
          <div className="bg-secondary rounded-xl p-4 space-y-3 border border-border">
            <h4 className="font-semibold text-foreground text-sm">
              {t("uploadReceipt")}
            </h4>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleReceiptSelect}
            />

            {receiptPreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={receiptPreview}
                  alt="Receipt preview"
                  className="w-full max-h-48 object-contain rounded-lg border border-border"
                />
                {!uploaded && (
                  <button
                    onClick={removeReceipt}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {uploaded && (
                  <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Receipt ready to submit
                  </p>
                )}
              </div>
            ) : (
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary hover:bg-secondary/50 transition-colors">
                  <ImagePlus className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-foreground">
                    Tap to upload receipt
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG or WebP · Max 5MB
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleReceiptSelect}
                />
              </label>
            )}
          </div>

          <Button
            className="w-full"
            disabled={!receiptFile || uploading}
            onClick={handleSubmit}
          >
            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
