"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Quote, Award, Building2 } from "lucide-react";

export function Leadership() {
  return (
    <section className="relative isolate overflow-hidden py-24 sm:py-28 lg:py-32">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-brand-gradient-deep" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-brand-radial opacity-80" />
      <div className="pointer-events-none absolute inset-0 -z-10 noise opacity-[0.04]" />

      <div className="container-x">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr,1.2fr]">
          {/* Portrait card */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="relative mx-auto w-full max-w-md"
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/15 bg-white shadow-2xl">
              <Image
                src="/images/owner.png"
                alt="Mr. R. Venkatesan, Managing Director of VSYK CHITS"
                fill
                className="object-cover object-[50%_18%]"
                sizes="(max-width: 768px) 90vw, 420px"
              />
              {/* Subtle bottom gradient so the nameplate sits elegantly over the photo */}
              <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 backdrop-blur-md"
              >
                <Award className="h-4 w-4 text-teal-300" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-white">
                  30+ Years
                </span>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="absolute -bottom-6 left-1/2 -translate-x-1/2 rounded-2xl border border-white/15 bg-brand-700/90 px-6 py-3 text-center shadow-brand-xl backdrop-blur-md"
            >
              <p className="font-display text-base font-bold text-white">Mr. R. Venkatesan</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-300">
                Managing Director
              </p>
            </motion.div>
          </motion.div>

          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-300" />
              Leadership with vision
            </span>

            <h2 className="mt-5 font-display text-display-lg font-bold leading-[1.1] text-white">
              Three decades of experience.
              <br /> One promise to <span className="text-teal-300">every family.</span>
            </h2>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
              Guided by Managing Director Mr. R. Venkatesan, VSYK CHITS is built on three
              decades of profound experience in the financial services and chit fund industry.
              Every scheme we run, every auction we host, and every rupee we manage carries
              that legacy of trust.
            </p>

            <figure className="mt-8 rounded-3xl border border-white/15 bg-white/[0.06] p-6 backdrop-blur-md sm:p-7">
              <Quote className="h-6 w-6 text-teal-300" />
              <blockquote className="mt-3 font-display text-lg font-medium leading-relaxed text-white sm:text-xl">
                &ldquo;A chit fund is more than a financial product — it is a promise between
                neighbours. Our job is to keep that promise, transparently, every single
                month.&rdquo;
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 text-sm text-white/70">
                <Building2 className="h-4 w-4 text-teal-300" />
                R. Venkatesan · Managing Director, VSYK CHITS
              </figcaption>
            </figure>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
