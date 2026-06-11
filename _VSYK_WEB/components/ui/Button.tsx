import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import { ArrowRight } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "glow";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white shadow-premium hover:bg-brand-600 hover:-translate-y-0.5 hover:shadow-brand-xl",
  secondary:
    "border border-brand-500/20 bg-white text-brand-700 shadow-brand-sm hover:border-brand-500/40 hover:bg-brand-50 hover:-translate-y-0.5",
  ghost:
    "text-ink/80 hover:text-brand-700 hover:bg-brand-50",
  outline:
    "border border-white/30 bg-white/10 text-white backdrop-blur-md hover:bg-white/20",
  glow:
    "bg-gradient-to-r from-brand-500 via-teal-500 to-teal-300 text-white shadow-brand-glow hover:shadow-brand-xl hover:-translate-y-0.5",
};

const sizes = {
  sm: "px-4 py-2.5 text-[13px]",
  md: "px-6 py-3.5 text-sm",
  lg: "px-7 py-4 text-base",
} as const;

type CommonProps = {
  variant?: Variant;
  size?: keyof typeof sizes;
  withArrow?: boolean;
  children: ReactNode;
  className?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  withArrow,
  className,
  children,
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "group inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-300 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
      {withArrow && (
        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      )}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  withArrow,
  className,
  children,
  ...props
}: CommonProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn(
        "group inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-300 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
      {withArrow && (
        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      )}
    </a>
  );
}
