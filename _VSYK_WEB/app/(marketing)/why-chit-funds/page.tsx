import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";
import { WhyItMatters } from "@/components/why/WhyItMatters";
import { Benefits } from "@/components/why/Benefits";
import { ComparisonMatrix } from "@/components/why/ComparisonMatrix";
import { WhyStats } from "@/components/why/WhyStats";
import { HowItWorks } from "@/components/home/HowItWorks";
import { GoalsGrid } from "@/components/home/GoalsGrid";
import { WhoItsFor } from "@/components/why/WhoItsFor";
import { FinalCTA } from "@/components/home/FinalCTA";

export const metadata = {
  title: "Why Chit Funds? | VSYK CHITS",
  description:
    "Why chit funds are a reliable, disciplined and flexible way to save — compared with bank deposits, mutual funds and gold loans. Built for salaried employees, business owners and families.",
};

export default function WhyChitFundsPage() {
  return (
    <>
      <PageHero
        eyebrow="Why Chit Funds?"
        title={
          <>
            Disciplined savings, with the{" "}
            <span className="text-gradient">flexibility of credit.</span>
          </>
        }
        description="A chit fund is one of India's oldest, most practical financial tools — a way to save consistently while keeping a lump sum within reach. Here's why it works, and why families trust VSYK to run it right."
        actions={
          <>
            <Link
              href="/contact"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-7 py-4 text-sm font-semibold text-white shadow-premium transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-brand-xl"
            >
              Get Started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-500/20 bg-white px-7 py-4 text-sm font-semibold text-brand-700 shadow-brand-sm transition-all hover:-translate-y-0.5 hover:bg-brand-50"
            >
              How a Chit Works
            </Link>
          </>
        }
      />

      <WhyItMatters />
      <Benefits />
      <ComparisonMatrix />
      <WhyStats />
      <HowItWorks />
      <GoalsGrid />
      <WhoItsFor />
      <FinalCTA />
    </>
  );
}
