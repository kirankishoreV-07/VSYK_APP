"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  MessageSquare,
  CheckCircle2,
  Building2,
  Headphones,
  ArrowRight,
} from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";
import { SectionHeader } from "@/components/ui/SectionHeader";

const SUPPORT_CHANNELS = [
  {
    icon: Phone,
    title: "Speak to an advisor",
    body: "+91 98429 88812",
    sub: "Mon-Sat · 9am-6pm",
    accent: "from-brand-500 to-teal-500",
  },
  {
    icon: Mail,
    title: "Drop us an email",
    body: "vsykchits@gmail.com",
    sub: "Replies within 24 hours",
    accent: "from-teal-500 to-brand-600",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp support",
    body: "+91 98429 88812",
    sub: "Tap to chat instantly",
    accent: "from-brand-700 to-teal-500",
  },
];

const OFFICES = [
  {
    city: "Coimbatore",
    address: "No. 7, 1st Floor, 40/41 SNR Towers, Vysial Street, Coimbatore, Tamil Nadu - 641001",
    phone: "+91 98429 88812",
    hours: "Mon-Sat · 9am-6pm",
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
        description="Whether you're choosing your first chit or have a detailed query about a specific scheme — our advisors will get back to you within one business day."
      />

      {/* Support channels */}
      <section className="relative pb-16">
        <div className="container-x">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SUPPORT_CHANNELS.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.06 }}
                className="group relative overflow-hidden rounded-3xl border border-outline-soft bg-white p-6 shadow-brand-sm transition-all hover:-translate-y-1 hover:shadow-brand-lg"
              >
                <div className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${c.accent} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-30`} />
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${c.accent} text-white shadow-brand-md`}>
                  <c.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-display text-sm font-bold uppercase tracking-wider text-ink-fade">
                  {c.title}
                </h3>
                <p className="mt-1 font-display text-base font-bold text-ink">{c.body}</p>
                <p className="mt-0.5 text-xs text-ink-fade">{c.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Form + Map */}
      <section id="support" className="relative py-12 sm:py-16">
        <div className="container-x">
          <div className="grid gap-8 lg:grid-cols-[1.1fr,1fr]">
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7 }}
              className="relative overflow-hidden rounded-[2rem] border border-outline-soft bg-white p-7 shadow-brand-md sm:p-10"
            >
              <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-teal-300/12 blur-3xl" />
              <span className="eyebrow">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                Send us a message
              </span>
              <h2 className="mt-5 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
                Tell us about your goal.
                <br />
                <span className="text-gradient">We&apos;ll find the right scheme.</span>
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
                <Field
                  label="Goal / interest"
                  name="goal"
                  placeholder="e.g. ₹2 lakh chit for daughter's college fees"
                />
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-fade">
                    Message
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Tell us a bit more — we'll match the right scheme."
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
                      Message sent — we'll be in touch
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

            {/* Visual / Map */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="flex flex-col gap-6"
            >
              {/* Mapish card */}
              <div className="relative overflow-hidden rounded-[2rem] border border-outline-soft bg-white p-6 shadow-brand-md">
                <div className="relative h-64 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-50 to-teal-50">
                  <svg viewBox="0 0 400 260" className="absolute inset-0 h-full w-full opacity-70">
                    <defs>
                      <pattern id="mapgrid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(1,120,158,0.15)" strokeWidth="0.5" />
                      </pattern>
                    </defs>
                    <rect width="400" height="260" fill="url(#mapgrid)" />
                    <path d="M50 60 Q120 30, 200 80 T380 60" stroke="#01789E" strokeWidth="3" fill="none" opacity="0.4" strokeLinecap="round" />
                    <path d="M20 180 Q140 200, 260 160 T400 200" stroke="#10D7CD" strokeWidth="3" fill="none" opacity="0.4" strokeLinecap="round" />
                    <path d="M160 20 Q170 100, 220 160 T280 240" stroke="#01789E" strokeWidth="2" fill="none" opacity="0.3" strokeLinecap="round" />
                  </svg>
                  {/* Pin */}
                  <motion.div
                    initial={{ scale: 0, y: -10 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ delay: 0.4, type: "spring", stiffness: 280 }}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  >
                    <span className="relative grid h-12 w-12 place-items-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500/20" />
                      <span className="relative grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-teal-500 text-white shadow-brand-xl">
                        <MapPin className="h-5 w-5" />
                      </span>
                    </span>
                  </motion.div>
                </div>
                <div className="mt-5">
                  <h3 className="font-display text-lg font-bold text-ink">VSYK CHITS · Coimbatore</h3>
                  <p className="mt-1 text-sm text-ink-mute">
                    No. 7, 1st Floor, 40/41 SNR Towers, Vysial Street, Coimbatore, Tamil Nadu - 641001
                  </p>
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=No.+7%2C+1st+Floor%2C+40%2F41+SNR+Towers%2C+Vysial+Street%2C+Coimbatore%2C+Tamil+Nadu+-+641001"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
                  >
                    Get directions
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              {/* Hours */}
              <div className="rounded-[2rem] border border-outline-soft bg-white p-6 shadow-brand-sm">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  <Clock className="h-4 w-4" />
                </span>
                <h3 className="mt-4 font-display text-base font-bold text-ink">Office hours</h3>
                <p className="mt-1 text-sm text-ink-mute">Monday to Saturday · 9:00 AM to 6:00 PM</p>
                <p className="mt-0.5 text-sm text-ink-mute">Sunday & national holidays · Closed</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Offices */}
      <section className="relative py-24 sm:py-28">
        <div className="container-x">
          <SectionHeader
            eyebrow="Our office"
            title={
              <>
                Visit us. <span className="text-gradient">We&apos;re in Coimbatore.</span>
              </>
            }
            description="VSYK is rooted in the community we serve. Walk into our Coimbatore office and a member of our team will be happy to help."
          />
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {OFFICES.map((o, i) => (
              <motion.div
                key={o.city}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.07 }}
                className="group relative overflow-hidden rounded-3xl border border-outline-soft bg-white p-7 shadow-brand-sm transition-all hover:-translate-y-1 hover:shadow-brand-lg"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-teal-500 text-white shadow-brand-md">
                  <Building2 className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-display text-lg font-bold text-ink">{o.city}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-mute">{o.address}</p>
                <div className="mt-5 space-y-2 text-sm">
                  <p className="flex items-center gap-2 text-ink">
                    <Phone className="h-4 w-4 text-teal-600" />
                    {o.phone}
                  </p>
                  <p className="flex items-center gap-2 text-ink-mute">
                    <Clock className="h-4 w-4 text-teal-600" />
                    {o.hours}
                  </p>
                </div>
              </motion.div>
            ))}
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
