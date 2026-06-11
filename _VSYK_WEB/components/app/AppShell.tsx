"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  Gavel,
  CreditCard,
  User,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Logo } from "@/components/icons/Logo";
import { useMemberSession } from "@/lib/member-session";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/app/ui";

const NAV = [
  { label: "Dashboard", href: "/app", icon: LayoutDashboard },
  { label: "My Chits", href: "/app/chits", icon: CreditCard },
  { label: "Auctions", href: "/app/auctions", icon: Gavel },
  { label: "Wallet", href: "/app/wallet", icon: Wallet },
  { label: "Profile", href: "/app/profile", icon: User },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { memberId, memberProfile, isLoading, logout } = useMemberSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !memberId) router.replace("/login");
  }, [isLoading, memberId, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (isLoading || !memberId) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-alt">
        <Spinner className="h-7 w-7 text-brand-500" />
      </div>
    );
  }

  const initials = (memberProfile?.full_name || "VSYK")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  const SideNav = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors",
              active
                ? "bg-brand-50 text-brand-700"
                : "text-ink-mute hover:bg-surface-mute hover:text-ink"
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-surface-alt">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-outline-soft bg-white lg:flex">
        <div className="px-6 py-6">
          <Link href="/app">
            <Logo size={36} />
          </Link>
        </div>
        {SideNav}
        <div className="border-t border-outline-soft p-3">
          <div className="flex items-center gap-3 rounded-2xl px-3 py-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-gradient text-xs font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {memberProfile?.full_name || "Member"}
              </p>
              <p className="truncate text-xs text-ink-fade">
                {memberProfile?.phone}
              </p>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Log out"
              className="grid h-8 w-8 place-items-center rounded-xl text-ink-fade hover:bg-rose-50 hover:text-rose-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-outline-soft bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/app">
          <Logo size={32} />
        </Link>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
          className="grid h-10 w-10 place-items-center rounded-full border border-outline-soft"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/30"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white pt-20">
            {SideNav}
            <div className="border-t border-outline-soft p-3">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
