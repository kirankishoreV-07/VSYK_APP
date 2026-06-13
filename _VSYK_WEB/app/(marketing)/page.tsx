import { Hero } from "@/components/home/Hero";
import { TrustStats } from "@/components/home/TrustStats";
import { TrustMarquee } from "@/components/home/TrustMarquee";
import { Features } from "@/components/home/Features";
import { Leadership } from "@/components/home/Leadership";
import { ChitCalculator } from "@/components/home/ChitCalculator";
import { Testimonials } from "@/components/home/Testimonials";
import { FAQ } from "@/components/home/FAQ";
import { FinalCTA } from "@/components/home/FinalCTA";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustStats />
      <TrustMarquee />
      <Features />
      <Leadership />
      <ChitCalculator />
      <Testimonials />
      <FAQ />
      <FinalCTA />
    </>
  );
}
