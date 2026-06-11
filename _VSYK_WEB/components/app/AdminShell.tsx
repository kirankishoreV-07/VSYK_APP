"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Users,
  Layers,
  Gavel,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/icons/Logo";
import { useAdminSession } from "@/lib/admin-session";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/app/ui";

const NAV = [
  { label: "Dashboard", href: "/admin", icon: LayoutGrid },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Groups", href: "/admin/groups", icon: Layers },
  { label: "Auctions", href: "/admin/auctions", icon: Gavel },
  { label: "Reports", href: "/admin/reports", icon: BarChart3 },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { username, isLoading, isAuthed, logout } = useAdminSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthed) router.replace("/login");
  }, [isLoading, isAuthed, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (isLoading || !isAuthed) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-alt">
        <Spinner className="h-7 w-7 text-brand-500" />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

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
                ? "bg-brand-700 text-white"
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
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-outline-soft bg-white lg:flex">
        <div className="flex items-center gap-2 px-6 py-6">
          <Logo size={34} withText={false} />
          <div>
            <p className="font-display text-sm font-bold text-ink">VSYK</p>
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand-600">
              <ShieldCheck className="h-3 w-3" /> Admin
            </p>
          </div>
        </div>
        {SideNav}
        <div className="border-t border-outline-soft p-3">
          <div className="flex items-center gap-3 rounded-2xl px-3 py-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white">
              {(username || "AD").slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {username}
              </p>
              <p className="text-xs text-ink-fade">Administrator</p>
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

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-outline-soft bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <Logo size={30} withText={false} />
          <span className="text-sm font-bold text-ink">VSYK Admin</span>
        </div>
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
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
