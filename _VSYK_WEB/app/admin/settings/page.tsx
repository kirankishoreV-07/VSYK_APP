"use client";

import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Database,
  LogOut,
  User,
  Server,
  KeyRound,
} from "lucide-react";
import { useAdminSession } from "@/lib/admin-session";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, Badge } from "@/components/app/ui";

export default function AdminSettingsPage() {
  const router = useRouter();
  const { username, logout } = useAdminSession();

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "Not configured";

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Admin account and platform configuration."
      />

      <h2 className="mb-3 text-base font-semibold text-ink">Account</h2>
      <Card className="divide-y divide-outline-soft p-0">
        <Row
          icon={<User className="h-4 w-4" />}
          label="Signed in as"
          value={username || "—"}
        />
        <Row
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Role"
          value="Administrator"
        />
      </Card>

      <h2 className="mb-3 mt-8 text-base font-semibold text-ink">
        Backend Connection
      </h2>
      <Card className="divide-y divide-outline-soft p-0">
        <Row
          icon={<Server className="h-4 w-4" />}
          label="Supabase Project"
          value={supabaseUrl.replace("https://", "")}
        />
        <Row
          icon={<Database className="h-4 w-4" />}
          label="Data Source"
          value="Shared with mobile app"
          badge={<Badge tone="success">Live</Badge>}
        />
        <Row
          icon={<KeyRound className="h-4 w-4" />}
          label="Access"
          value="Anon key (demo RLS)"
        />
      </Card>

      <button
        onClick={handleLogout}
        className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100"
      >
        <LogOut className="h-4 w-4" /> Log out
      </button>
    </>
  );
}

function Row({
  icon,
  label,
  value,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-mute text-ink-fade">
        {icon}
      </span>
      <span className="text-sm text-ink-fade">{label}</span>
      <span className="ml-auto flex items-center gap-2 text-right text-sm font-medium text-ink">
        {value}
        {badge}
      </span>
    </div>
  );
}
