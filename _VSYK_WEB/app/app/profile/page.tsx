"use client";

import { useRouter } from "next/navigation";
import {
  User,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Users,
  LogOut,
  CreditCard,
} from "lucide-react";
import { useMemberSession } from "@/lib/member-session";
import { useNominees } from "@/lib/queries";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, Badge, Spinner, EmptyState } from "@/components/app/ui";
import { formatDateIST } from "@/lib/utils";

export default function ProfilePage() {
  const router = useRouter();
  const { memberId, memberProfile, isLoading, logout } = useMemberSession();
  const nominees = useNominees(memberId);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="h-7 w-7 text-brand-500" />
      </div>
    );
  }

  const p = memberProfile;
  const initials = (p?.full_name || "VSYK")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const kyc = (p?.kyc_status || "pending").toLowerCase();

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const address = [
    p?.address_line1,
    p?.address_line2,
    p?.city,
    p?.state,
    p?.postal_code,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <PageHeader title="Profile" subtitle="Your account details and settings." />

      <Card className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-gradient text-lg font-bold text-white">
          {initials}
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-ink">
            {p?.full_name || "Member"}
          </h2>
          <p className="text-sm text-ink-fade">
            {p?.customer_id ? `${p.customer_id} · ` : ""}
            Member since {formatDateIST(p?.created_at)}
          </p>
        </div>
        <Badge tone={kyc === "verified" ? "success" : "warning"}>
          <ShieldCheck className="h-3 w-3" /> KYC {kyc}
        </Badge>
      </Card>

      <h2 className="mb-3 mt-8 text-base font-semibold text-ink">
        Contact Details
      </h2>
      <Card className="divide-y divide-outline-soft p-0">
        <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={p?.phone} />
        <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={p?.email} />
        <InfoRow
          icon={<CreditCard className="h-4 w-4" />}
          label="PAN"
          value={p?.pan_number}
        />
        <InfoRow
          icon={<MapPin className="h-4 w-4" />}
          label="Address"
          value={address || null}
        />
      </Card>

      <h2 className="mb-3 mt-8 text-base font-semibold text-ink">Nominees</h2>
      {nominees.isLoading ? (
        <Card className="grid place-items-center py-10">
          <Spinner className="h-5 w-5 text-brand-500" />
        </Card>
      ) : !nominees.data?.length ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No nominees added"
          message="Add a nominee to secure your chit fund benefits."
        />
      ) : (
        <Card className="divide-y divide-outline-soft p-0">
          {nominees.data.map((n) => (
            <div key={n.id} className="flex items-center gap-4 px-4 py-3.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <User className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">{n.full_name}</p>
                <p className="text-xs text-ink-fade">
                  {n.relationship || "Nominee"}
                  {n.phone_number ? ` · ${n.phone_number}` : ""}
                </p>
              </div>
              {n.allocation_percentage != null && (
                <Badge tone="info">{n.allocation_percentage}%</Badge>
              )}
            </div>
          ))}
        </Card>
      )}

      <button
        onClick={handleLogout}
        className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100"
      >
        <LogOut className="h-4 w-4" /> Log out
      </button>
    </>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-mute text-ink-fade">
        {icon}
      </span>
      <span className="text-sm text-ink-fade">{label}</span>
      <span className="ml-auto text-right text-sm font-medium text-ink">
        {value || "—"}
      </span>
    </div>
  );
}
