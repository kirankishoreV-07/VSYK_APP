"use client";

import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-outline-soft bg-white p-5 shadow-soft",
        className
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "brand",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: "brand" | "teal" | "amber" | "rose" | "emerald";
}) {
  const accents: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600",
    teal: "bg-teal-50 text-teal-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-fade">
          {label}
        </span>
        {icon && (
          <span
            className={cn(
              "grid h-9 w-9 place-items-center rounded-xl",
              accents[accent]
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold tracking-tight text-ink">{value}</div>
      {sub && <div className="text-xs text-ink-fade">{sub}</div>}
    </Card>
  );
}

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  const tones: Record<BadgeTone, string> = {
    neutral: "bg-surface-mute text-ink-mute",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-rose-50 text-rose-700",
    info: "bg-brand-50 text-brand-700",
    brand: "bg-teal-50 text-teal-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Input({
  label,
  hint,
  className,
  prefix,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  prefix?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      {label && (
        <span className="ml-1 text-xs font-semibold uppercase tracking-wide text-ink-fade">
          {label}
        </span>
      )}
      <span
        className={cn(
          "flex items-center rounded-2xl border border-surface-deep bg-white transition-colors focus-within:border-teal-500",
          className
        )}
      >
        {prefix && (
          <span className="pl-4 pr-1 text-base font-medium text-ink-fade">
            {prefix}
          </span>
        )}
        <input
          className="w-full bg-transparent px-4 py-3.5 text-base text-ink outline-none placeholder:text-surface-deep"
          {...props}
        />
      </span>
      {hint && <span className="ml-1 text-xs text-ink-fade">{hint}</span>}
    </label>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin", className)} />;
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-outline-soft bg-white/60 px-6 py-14 text-center">
      {icon && (
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-mute text-ink-fade">
          {icon}
        </span>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {message && <p className="max-w-sm text-sm text-ink-fade">{message}</p>}
      {action}
    </div>
  );
}

export function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-surface-mute",
        className
      )}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-teal-500 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
