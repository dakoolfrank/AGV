// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// ✅ Static import of a Client Component is allowed in a Server Component
import { Providers } from "./provider";
import { PageLoading } from "@/components/ui/page-loading";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
export const metadata: Metadata = {
  title: "AGV Protocol - Unlocking Real-World Assets On-Chain",
  description:
    "AGV Protocol bridges real-world assets with blockchain through tokenization, asset-mapped NFTs, and a dual-token system. Mint SeedPass, TreePass, SolarPass, and ComputePass NFTs backed by real orchards, solar, and compute units.",
  keywords: [
    "AGV Protocol",
    "real-world assets",
    "RWA",
    "blockchain",
    "NFT minting",
    "DeFi",
    "tokenization",
    "crypto yield",
    "GVT",
    "rGGP",
    "SeedPass",
    "TreePass",
    "SolarPass",
    "ComputePass"
  ],
  authors: [{ name: "AGV Protocol Official" }],
  creator: "AGV Protocol",
  publisher: "AGV Protocol",
  formatDetection: { email: false, address: false, telephone: false },
  metadataBase: new URL("https://agv-protocol.com"),
  openGraph: {
    title: "AGV Protocol - Unlocking Real-World Assets On-Chain",
    description:
      "Explore AGV Protocol: bridging DeFi and TradFi through tokenized real-world assets. Mint asset-backed NFTs like SeedPass, TreePass, SolarPass, and ComputePass today.",
    type: "website",
    locale: "en_US",
    url: "https://agv-protocol.com",
    siteName: "AGV Protocol",
  },
  twitter: {
    card: "summary_large_image",
    title: "AGV Protocol - Unlocking Real-World Assets On-Chain",
    description:
      "AGV Protocol makes real-world assets accessible via blockchain. Mint NFTs backed by orchards, solar power, and compute clusters. Join the future of inclusive finance.",
    creator: "@AGVProtocol",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        <link rel="alternate" hrefLang="en" href="/en" />
        <link rel="alternate" hrefLang="zh-CN" href="/zh-CN" />
        <link rel="alternate" hrefLang="zh-TW" href="/zh-TW" />
        <link rel="alternate" hrefLang="ko" href="/ko" />
        <link rel="alternate" hrefLang="tl" href="/tl" />
        <link rel="alternate" hrefLang="fr" href="/fr" />
        <link rel="alternate" hrefLang="de" href="/de" />
        <link rel="alternate" hrefLang="es" href="/es" />
        <link rel="alternate" hrefLang="ar" href="/ar" />
        <link rel="alternate" hrefLang="ja" href="/ja" />
        <link rel="alternate" hrefLang="x-default" href="/en" />
      </head>
      <body className={`${inter.className} antialiased`}>
        {/* ✅ Providers is a client component, rendered directly */}
        <Providers>
          <PageLoading />
          {children}
        </Providers>
      </body>
    </html>
  );
}
