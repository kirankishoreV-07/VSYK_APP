import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatINRCompact(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(2)} L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value}`;
}

// Backend stores money as integer paise (mobile parity). Convert before display.
export function paiseToRupees(paise: number | null | undefined): number {
  return Math.round((paise ?? 0)) / 100;
}

export function formatPaise(paise: number | null | undefined): string {
  return formatINR(paiseToRupees(paise));
}

export function formatPaiseCompact(paise: number | null | undefined): string {
  return formatINRCompact(paiseToRupees(paise));
}

// Stored UTC, displayed IST (mobile parity).
export function formatDateIST(
  value: string | null | undefined,
  withTime = false
): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
