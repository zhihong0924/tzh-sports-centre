"use client";

import { useState, useEffect, useCallback } from "react";

interface CountdownTimerProps {
  expiresAt: string | Date;
  onExpire?: () => void;
}

export function CountdownTimer({ expiresAt, onExpire }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [expired, setExpired] = useState(false);

  const calculateTimeLeft = useCallback(() => {
    const expires = new Date(expiresAt).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((expires - now) / 1000));
  }, [expiresAt]);

  useEffect(() => {
    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        setExpired(true);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateTimeLeft, onExpire]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft <= 120; // < 2 minutes

  if (expired) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-destructive">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="font-semibold">Payment time expired</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-4 py-3 font-mono text-lg ${
        isUrgent
          ? "animate-pulse bg-destructive/10 text-destructive"
          : "bg-primary/10 text-primary"
      }`}
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="font-semibold">
        {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
      </span>
      <span className="text-sm font-normal text-muted-foreground">remaining</span>
    </div>
  );
}
