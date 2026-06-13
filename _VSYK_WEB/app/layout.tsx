import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vsykchits.in"),
  title: {
    default: "VSYK CHITS — Your Trusted Financial Partner",
    template: "%s · VSYK CHITS",
  },
  description:
    "VSYK CHITS turns disciplined monthly savings into a flexible corpus — funding education, healthcare, business and life's milestones. Banking-grade security, transparent auctions, decades of trust.",
  keywords: [
    "VSYK Chits",
    "chit fund",
    "chit fund India",
    "savings",
    "monthly chit",
    "auction",
    "MR VENKATESAN.R",
    "trusted chit fund",
  ],
  authors: [{ name: "VSYK CHITS" }],
  openGraph: {
    title: "VSYK CHITS — Your Trusted Financial Partner",
    description:
      "Disciplined savings. Transparent auctions. A flexible corpus for life's biggest moments.",
    type: "website",
    locale: "en_IN",
    siteName: "VSYK CHITS",
    images: [
      {
        url: '/images/logo.png',
        width: 512,
        height: 512,
        alt: 'VSYK CHITS Logo',
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VSYK CHITS — Your Trusted Financial Partner",
    description:
      "Disciplined savings. Transparent auctions. A flexible corpus for life's biggest moments.",
    images: ['/images/logo.png'],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'VSYK CHITS',
    url: 'https://vsykchits.in',
    logo: 'https://vsykchits.in/images/logo.png',
    description:
      "VSYK CHITS turns disciplined monthly savings into a flexible corpus — funding education, healthcare, business and life's milestones. Banking-grade security, transparent auctions, decades of trust.",
    founder: {
      '@type': 'Person',
      name: 'MR VENKATESAN.R',
    },
  };

  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen bg-surface-alt antialiased">
        <Providers>{children}</Providers>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
