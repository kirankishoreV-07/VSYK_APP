"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";

const CHANNELS = [
  {
    icon: Phone,
    title: "Call us",
    body: "+91 98429 88812",
    href: "tel:+919842988812",
    sub: "Mon–Sat · 9am–6pm",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp",
    body: "+91 98429 88812",
    href: "https://wa.me/919842988812",
    sub: "Tap to chat instantly",
  },
  {
    icon: Mail,
    title: "Email",
    body: "vsykchits@gmail.com",
    href: "mailto:vsykchits@gmail.com",
    sub: "Replies within 24 hours",
  },
];

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <>
      <PageHero
        eyebrow="Talk to us"
        title={
          <>
            Have a question?
            <br />
            <span className="text-gradient">We&apos;re a message away.</span>
          </>
        }
        description="Whether you're starting your first chit or have a detailed query — our advisor will get back to you within one business day."
      />

      {/* Simple contact channels */}
      <section className="relative pb-14">
        <div className="container-x">
          <div className="grid gap-4 sm:grid-cols-3">
            {CHANNELS.map((c, i) => (
              <motion.a
                key={c.title}
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="group flex items-center gap-4 rounded-2xl border border-outline-soft bg-white p-5 shadow-brand-sm transition-all hover:-translate-y-1 hover:border-brand-500/30 hover:shadow-brand-md"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                  <c.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-fade">
                    {c.title}
                  </p>
                  <p className="font-display text-base font-bold text-ink">{c.body}</p>
                  <p className="text-xs text-ink-fade">{c.sub}</p>
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* Form + Advisor */}
      <section id="support" className="relative pb-24 sm:pb-28">
        <div className="container-x">
          <div className="grid gap-6 lg:grid-cols-[1.1fr,1fr]">
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7 }}
              className="rounded-[2rem] border border-outline-soft bg-white p-7 shadow-brand-md sm:p-10"
            >
              <span className="eyebrow">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                Send us a message
              </span>
              <h2 className="mt-5 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
                Tell us about your goal.
                <br />
                <span className="text-gradient">We&apos;ll point you the right way.</span>
              </h2>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSent(true);
                  setTimeout(() => setSent(false), 4500);
                }}
                className="mt-7 grid gap-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" name="name" placeholder="Your name" />
                  <Field label="Phone number" name="phone" type="tel" placeholder="+91 ..." />
                </div>
                <Field label="Email" name="email" type="email" placeholder="you@email.com" />
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-fade">
                    Message
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Tell us a bit more about what you're planning for."
                    className="mt-2 w-full resize-none rounded-2xl border border-outline-soft bg-surface-mute/40 px-4 py-3.5 text-sm text-ink shadow-soft transition-all focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>

                <button
                  type="submit"
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-7 py-4 text-sm font-semibold text-white shadow-premium transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-brand-xl disabled:opacity-50"
                  disabled={sent}
                >
                  {sent ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Message sent — we&apos;ll be in touch
                    </>
                  ) : (
                    <>
                      Send Message
                      <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>

                <p className="text-[12px] text-ink-fade">
                  By submitting, you agree to our privacy policy. We never share your details.
                </p>
              </form>
            </motion.div>

            {/* Advisor + office */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="flex flex-col gap-6"
            >
              {/* Advisor card */}
              <div className="overflow-hidden rounded-[2rem] border border-outline-soft bg-white shadow-brand-md">
                <div className="relative h-64 overflow-hidden sm:h-72">
                  <Image
                    src="/images/advisor.png"
                    alt="MR VENKATESAN.R, Managing Director of VSYK CHITS"
                    fill
                    className="object-cover object-[50%_22%]"
                    sizes="(max-width: 1024px) 100vw, 420px"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-brand-950/85 via-brand-950/30 to-transparent" />
                  <div className="absolute bottom-4 left-5 right-5">
                    <p className="font-display text-lg font-bold tracking-[0.08em] text-white">MR VENKATESAN.R</p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-300">
                      Managing Director · Your Advisor
                    </p>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-sm leading-relaxed text-ink-mute">
                    Speak directly with our team — a real person who will understand your goal and
                    guide you to the right chit.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <a
                      href="https://wa.me/919842988812"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-premium transition-all hover:-translate-y-0.5 hover:bg-brand-600"
                    >
                      <MessageSquare className="h-4 w-4" /> WhatsApp
                    </a>
                    <a
                      href="tel:+919842988812"
                      className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 transition-all hover:-translate-y-0.5 hover:bg-brand-50"
                    >
                      <Phone className="h-4 w-4" /> Call
                    </a>
                  </div>
                </div>
              </div>

              {/* Office + hours */}
              <div className="rounded-[2rem] border border-outline-soft bg-white p-6 shadow-brand-sm">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-ink">Visit our office</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-mute">
                      No. 7, 1st Floor, 40/41 SNR Towers, Vysial Street, Coimbatore, Tamil Nadu -
                      641001
                    </p>
                    <a
                      href="https://www.google.com/maps/search/?api=1&query=No.+7%2C+1st+Floor%2C+40%2F41+SNR+Towers%2C+Vysial+Street%2C+Coimbatore%2C+Tamil+Nadu+-+641001"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
                    >
                      Get directions
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
                <div className="mt-5 flex items-start gap-3 border-t border-outline-soft pt-5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                    <Clock className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-ink">Office hours</h3>
                    <p className="mt-1 text-sm text-ink-mute">Monday to Saturday · 9:00 AM – 6:00 PM</p>
                    <p className="text-sm text-ink-mute">Sunday &amp; holidays · Closed</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-fade"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-outline-soft bg-surface-mute/40 px-4 py-3.5 text-sm text-ink shadow-soft transition-all placeholder:text-ink-fade/60 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      />
    </div>
  );
}
