"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mail,
  Phone,
  MapPin,
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/icons/Logo";

const LINK_GROUPS = [
  {
    title: "Explore",
    items: [
      { label: "Home", href: "/" },
      { label: "About VSYK", href: "/about" },
      { label: "Chit Schemes", href: "/schemes" },
      { label: "How It Works", href: "/how-it-works" },
      { label: "Auctions", href: "/auctions" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "For Members",
    items: [
      { label: "Join a Chit", href: "/schemes" },
      { label: "Member Login", href: "/contact" },
      { label: "Payment Options", href: "/how-it-works#payments" },
      { label: "Auction Calendar", href: "/auctions" },
      { label: "Dividends", href: "/how-it-works#dividends" },
    ],
  },
  {
    title: "Trust & Safety",
    items: [
      { label: "Regulatory Compliance", href: "/about#compliance" },
      { label: "Privacy Policy", href: "/about#privacy" },
      { label: "Terms of Service", href: "/about#terms" },
      { label: "Security", href: "/about#security" },
    ],
  },
];

const SOCIAL = [
  { icon: Linkedin, label: "LinkedIn", href: "#" },
  { icon: Twitter, label: "Twitter", href: "#" },
  { icon: Instagram, label: "Instagram", href: "#" },
  { icon: Facebook, label: "Facebook", href: "#" },
];

export function Footer() {
  return (
    <footer className="relative isolate overflow-hidden bg-brand-gradient-deep text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-brand-radial opacity-90" />
      <div className="pointer-events-none absolute inset-0 -z-10 noise opacity-[0.04]" />

      {/* CTA Banner */}
      <div className="container-x pt-16 sm:pt-20 lg:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="relative overflow-hidden rounded-[2.5rem] border border-white/15 bg-white/[0.06] p-8 backdrop-blur-xl sm:p-12 lg:p-16"
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-teal-300/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-brand-400/30 blur-3xl" />

          <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr,1fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-300" />
                Ready when you are
              </span>
              <h3 className="mt-5 font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
                Build your <span className="text-teal-300">flexible corpus</span>
                <br /> the disciplined way.
              </h3>
              <p className="mt-4 max-w-xl text-base text-white/75 sm:text-lg">
                Join thousands of families turning monthly savings into milestones — with
                banking-grade security and complete transparency.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <Link
                href="/schemes"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-semibold text-brand-700 shadow-brand-xl transition-all duration-300 hover:-translate-y-0.5"
              >
                Browse Chit Schemes
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-white/5 px-7 py-4 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/10"
              >
                Talk to an Advisor
              </Link>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main Footer Grid */}
      <div className="container-x pt-16 pb-12">
        <div className="grid gap-12 lg:grid-cols-[1.4fr,3fr]">
          <div className="space-y-6">
            <Logo size={44} variant="white" />
            <p className="max-w-sm text-sm leading-relaxed text-white/70">
              VSYK CHITS — Your trusted financial partner. Disciplined savings, transparent
              auctions, decades of community trust under the leadership of MD R. Venkatesan.
            </p>
            <ul className="space-y-3 text-sm text-white/80">
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
                <span>+91 98429 88812 · Mon-Sat, 9am-6pm</span>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
                <span>vsykchits@gmail.com</span>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
                <span>No. 7, 1st Floor, 40/41 SNR Towers, Vysial Street, Coimbatore, Tamil Nadu - 641001</span>
              </li>
            </ul>
            <div className="flex items-center gap-2 pt-2">
              {SOCIAL.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/5 text-white/80 transition-all hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/15 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            {LINK_GROUPS.map((group) => (
              <div key={group.title}>
                <h4 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-white">
                  {group.title}
                </h4>
                <ul className="mt-5 space-y-3 text-sm text-white/70">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="group inline-flex items-center gap-1.5 transition-colors hover:text-teal-300"
                      >
                        <span>{item.label}</span>
                        <ArrowUpRight className="h-3 w-3 opacity-0 transition-all duration-300 group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Strip */}
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-semibold text-white/85">
              <ShieldCheck className="h-3 w-3 text-teal-300" />
              Banking-grade Security
            </span>
            <span>© {new Date().getFullYear()} VSYK CHITS · All rights reserved.</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-white/60">
            <Link href="/about#privacy" className="transition-colors hover:text-white">
              Privacy
            </Link>
            <Link href="/about#terms" className="transition-colors hover:text-white">
              Terms
            </Link>
            <Link href="/about#compliance" className="transition-colors hover:text-white">
              Compliance
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
