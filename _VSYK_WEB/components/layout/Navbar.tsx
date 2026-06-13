"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/icons/Logo";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Why Chit Funds?", href: "/why-chit-funds" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Auctions", href: "/auctions" },
  { label: "Contact", href: "/contact" },
];

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <motion.div
        initial={{ y: -32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "mx-auto mt-3 flex max-w-[1320px] items-center justify-between gap-6 rounded-full border px-4 py-2.5 transition-all duration-500 sm:mx-4 lg:mx-auto lg:px-6",
          scrolled
            ? "border-white/60 bg-white/85 shadow-brand-md backdrop-blur-xl"
            : "border-transparent bg-white/30 backdrop-blur-sm"
        )}
      >
        <Link href="/" aria-label="VSYK Chits home" className="shrink-0">
          <Logo size={36} />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
                  active ? "text-brand-700" : "text-ink/70 hover:text-brand-700"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-full bg-brand-50"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2.5 lg:flex">
          <Link
            href="/contact"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-ink/80 transition-colors hover:text-brand-700"
          >
            Get App
          </Link>
          <Link
            href="/login"
            className="group inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-5 py-2.5 text-[13px] font-semibold text-white shadow-premium transition-all duration-300 hover:bg-brand-600 hover:-translate-y-0.5 hover:shadow-brand-xl"
          >
            Login
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        <button
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-full border border-outline-soft bg-white shadow-soft lg:hidden"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="mx-4 mt-2 overflow-hidden rounded-3xl border border-white/60 bg-white/95 p-3 shadow-brand-lg backdrop-blur-xl lg:hidden"
          >
            <ul className="flex flex-col">
              {NAV_ITEMS.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition-colors",
                        active ? "bg-brand-50 text-brand-700" : "text-ink/80 hover:bg-surface-mute"
                      )}
                    >
                      {item.label}
                      <ArrowUpRight className="h-4 w-4 opacity-50" />
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link
              href="/login"
              className="mt-2 flex items-center justify-center gap-2 rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-premium"
            >
              Login
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
