import { cn } from "@/lib/utils";

type Props = {
  size?: number;
  withText?: boolean;
  className?: string;
  variant?: "default" | "white";
};

export function Logo({ size = 36, withText = true, className, variant = "default" }: Props) {
  const isWhite = variant === "white";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className="relative inline-flex items-center justify-center overflow-hidden rounded-2xl shadow-brand-md"
        style={{ width: size, height: size }}
      >
        <img
          src="/images/logo.png"
          alt="VSYK CHITS"
          className="h-full w-full object-contain"
        />
      </span>
      {withText && (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              "font-display text-[15px] font-bold tracking-tight",
              isWhite ? "text-white" : "text-ink"
            )}
          >
            VSYK
            <span className={cn("ml-1", isWhite ? "text-teal-300" : "text-brand-500")}>CHITS</span>
          </span>
          <span
            className={cn(
              "mt-1 text-[9px] font-semibold uppercase tracking-[0.18em]",
              isWhite ? "text-white/70" : "text-ink-fade"
            )}
          >
            Trusted Since Day One
          </span>
        </div>
      )}
    </div>
  );
}
