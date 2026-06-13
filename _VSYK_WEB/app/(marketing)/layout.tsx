import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ScrollProgress } from "@/components/layout/ScrollProgress";
import { LogoIntro } from "@/components/layout/LogoIntro";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <LogoIntro />
      <ScrollProgress />
      <Navbar />
      <main className="relative">{children}</main>
      <Footer />
    </>
  );
}
