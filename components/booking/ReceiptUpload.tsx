"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2, CheckCircle2, X } from "lucide-react";
import Image from "next/image";

interface ReceiptUploadProps {
  bookingId: string;
  onUploadSuccess?: (receiptUrl: string) => void;
  onUploadError?: (error: string) => void;
  disabled?: boolean;
}

export function ReceiptUpload({
  bookingId,
  onUploadSuccess,
  onUploadError,
  disabled = false,
}: ReceiptUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      onUploadError?.("Invalid file type. Please upload JPG, PNG, or WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onUploadError?.("File too large. Maximum size is 5MB.");
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/bookings/${bookingId}/upload-receipt`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setUploaded(true);
      onUploadSuccess?.(data.receiptUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      onUploadError?.(message);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    setUploaded(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || uploading || uploaded}
      />

      {preview ? (
        <div className="relative">
          <div className="relative h-48 w-full overflow-hidden rounded-lg border border-border">
            <Image
              src={preview}
              alt="Receipt preview"
              fill
              className="object-contain"
            />
          </div>
          {uploaded ? (
            <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Receipt uploaded successfully
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2"
              onClick={clearPreview}
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <Button
          variant="outline"
          className="h-32 w-full border-dashed border-2 border-border hover:border-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Uploading...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <ImagePlus className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Tap to upload payment receipt
              </span>
              <span className="text-xs text-muted-foreground">
                Max 5MB (JPG, PNG, WebP)
              </span>
            </div>
          )}
        </Button>
      )}
    </div>
  );
}
