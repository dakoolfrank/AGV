// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./provider";
import { PageLoading } from "@/components/ui/page-loading";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "G3 Fund - RWA KOL Incubation Platform",
  description: "The first RWA-native KOL incubation fund. Build sustainable community through tokenized partnerships and long-term growth incentives.",
  keywords: ["RWA", "KOL", "Real World Assets", "Community", "Incubation", "Fund"],
  authors: [{ name: "G3 Fund" }],
  creator: "G3 Fund",
  publisher: "G3 Fund",
  formatDetection: { email: false, address: false, telephone: false },
  metadataBase: new URL("https://g3fund.com"),
  openGraph: {
    title: "G3 Fund - RWA KOL Incubation Platform",
    description: "The first RWA-native KOL incubation fund. Build sustainable community through tokenized partnerships and long-term growth incentives.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "G3 Fund - RWA KOL Incubation Platform",
    description: "The first RWA-native KOL incubation fund. Build sustainable community through tokenized partnerships and long-term growth incentives.",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
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
        <Providers>
          <PageLoading />
          {children}
        </Providers>
      </body>
    </html>
  );
}
