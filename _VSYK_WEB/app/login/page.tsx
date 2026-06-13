"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/icons/Logo";
import { Input, Spinner } from "@/components/app/ui";
import { supabase } from "@/lib/supabase";
import { useMemberSession } from "@/lib/member-session";
import { cn } from "@/lib/utils";

type Role = "member" | "admin";

export default function LoginPage() {
  const router = useRouter();
  const { setMember } = useMemberSession();
  const [role, setRole] = useState<Role>("member");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pleasant "Coming Soon / Opens Soon" mode for now
  const [comingSoon, setComingSoon] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notified, setNotified] = useState(false);

  const handleMemberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanPhone = phone.trim().replace(/^\+91/, "");
    if (cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: dbError } = await supabase
        .from("customers")
        .select("id, full_name, phone")
        .or(`phone.eq.${cleanPhone},phone.eq.+91${cleanPhone}`)
        .single();
      if (dbError || !data) {
        setError(
          "This phone number is not registered. Please contact your admin."
        );
        setLoading(false);
        return;
      }
      await setMember(data.id);
      router.replace("/app");
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username || !password) {
      setError("Please enter both username and password.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: dbError } = await supabase
        .from("admin_users")
        .select("id, username")
        .eq("username", username)
        .eq("password", password)
        .single();
      if (dbError || !data) {
        setError("The username or password you entered is incorrect.");
        setLoading(false);
        return;
      }
      window.localStorage.setItem("vsyk_admin", data.username);
      router.replace("/admin");
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  // Pleasant teaser: On any "login" click, show a nice "Opens Soon" experience
  const handleOpensSoon = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Brief "verifying" moment for a pleasant, realistic feel, then reveal the coming soon message
    setTimeout(() => {
      setLoading(false);
      setComingSoon(true);
      setNotified(false);
      setNotifyEmail("");
    }, 650);
  };

  const handleNotify = (e: React.FormEvent) => {
    e.preventDefault();
    if (notifyEmail.trim()) {
      setNotified(true);
    }
  };

  const resetToForm = () => {
    setComingSoon(false);
    setNotified(false);
    setNotifyEmail("");
    setError(null);
  };

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-brand-gradient-deep lg:block">
        <div className="absolute inset-0 bg-mesh-hero opacity-60" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link href="/" className="inline-flex">
            <Logo size={40} variant="white" />
          </Link>
          <div className="space-y-6">
            <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight">
              Your chit funds and
              <br />
              savings auctions,
              <br />
              <span className="text-accent-glow">on the web.</span>
            </h1>
            <p className="max-w-md text-white/70">
              Access your portfolio, track payments, join live auctions and
              manage your VSYK membership — securely, from any device.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <ShieldCheck className="h-4 w-4" />
            Secured by VSYK Quantum Vault · Enterprise-grade encryption
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-surface-alt px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <Logo size={44} />
          </div>

          <div className="mb-7 text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-brand-700">
              Welcome Back
            </h2>
            <p className="mt-1 text-sm text-ink-mute">
              Access your chit funds and savings auctions securely.
            </p>
          </div>

          {/* Role selector */}
          <div className="mb-6 flex rounded-2xl bg-surface-mute p-1">
            {(["member", "admin"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRole(r);
                  setError(null);
                }}
                className={cn(
                  "flex-1 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-all",
                  role === r
                    ? "bg-white text-brand-700 shadow-soft"
                    : "text-ink-fade hover:text-ink-mute"
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="rounded-3xl border border-outline-soft bg-white p-6 shadow-brand-md">
            {comingSoon ? (
              /* Pleasant "Opens Soon / Coming Soon" experience — warm, on-brand, and non-disruptive */
              <AnimatePresence mode="wait">
                <motion.div
                  key={notified ? "notified" : "form"}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-center text-center py-3"
                >
                  <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-teal-500/10">
                    <Sparkles className="h-5 w-5 text-teal-600" />
                  </div>
                  <h3 className="font-display text-[22px] font-semibold tracking-tight text-ink">
                    Opens Soon
                  </h3>
                  <p className="mt-1.5 max-w-[30ch] text-sm leading-relaxed text-ink-mute">
                    The VSYK web portal for members and admins is launching very soon. 
                    We're putting the final touches on a secure, elegant experience.
                  </p>

                  {!notified ? (
                    <form onSubmit={handleNotify} className="mt-5 w-full">
                      <div className="flex gap-2">
                        <input
                          type="email"
                          placeholder="your@email.com"
                          value={notifyEmail}
                          onChange={(e) => setNotifyEmail(e.target.value)}
                          className="flex-1 rounded-xl border border-outline-soft bg-white px-4 py-2.5 text-sm placeholder:text-ink-fade focus:border-brand-500 focus:outline-none"
                          required
                        />
                        <button
                          type="submit"
                          className="rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition hover:bg-brand-600 active:bg-brand-700"
                        >
                          Notify me
                        </button>
                      </div>
                      <p className="mt-1 text-[10px] text-ink-fade">We'll let you know the moment it opens.</p>
                    </form>
                  ) : (
                    <div className="mt-4 w-full rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
                      Thank you! You're on the list. We'll email you as soon as the portal is live.
                    </div>
                  )}

                  <button
                    onClick={resetToForm}
                    className="mt-4 text-xs font-semibold text-ink-mute underline-offset-4 hover:text-ink hover:underline"
                  >
                    Back to login preview
                  </button>
                </motion.div>
              </AnimatePresence>
            ) : (
              /* Original form UI — now triggers the pleasant opens-soon experience on click */
              <>
                {role === "member" ? (
                  <form onSubmit={handleOpensSoon} className="flex flex-col gap-5">
                    <Input
                      label="Registered Phone Number"
                      prefix="+91"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="98765 43210"
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      hint="Enter the mobile number registered with your chit group admin."
                    />
                    {error && <p className="text-sm text-rose-600">{error}</p>}
                    <SubmitButton loading={loading} label="Access My Account" />
                  </form>
                ) : (
                  <form onSubmit={handleOpensSoon} className="flex flex-col gap-5">
                    <Input
                      label="Username"
                      autoCapitalize="none"
                      placeholder="Enter admin username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                    <Input
                      label="Password"
                      type="password"
                      placeholder="Enter admin password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    {error && <p className="text-sm text-rose-600">{error}</p>}
                    <SubmitButton loading={loading} label="Login to Admin Portal" />
                  </form>
                )}
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-ink-fade">
            Need help logging in?{" "}
            <Link href="/contact" className="font-semibold text-teal-600">
              Contact Support
            </Link>
          </p>
          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-ink-fade">
            <Sparkles className="h-3 w-3" />
            VSYK CHITS · web v1.0
          </div>
        </div>
      </div>
    </div>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-500 px-6 py-4 text-base font-semibold text-ink shadow-premium transition-all hover:bg-teal-600 hover:text-white disabled:opacity-60"
    >
      {loading ? (
        <>
          <Spinner className="h-5 w-5" /> Verifying…
        </>
      ) : (
        <>
          {label}
          <ArrowRight className="h-5 w-5" />
        </>
      )}
    </button>
  );
}
