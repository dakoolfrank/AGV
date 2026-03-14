import type { Metadata } from "next";
import { Inter, Poppins, Lato } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AGV NEXRUR - Investor Portal",
  description: "Access comprehensive documentation, financial models, and technical resources for AGV NEXRUR's innovative blockchain infrastructure.",
  keywords: ["AGV NEXRUR", "blockchain", "IoT", "real-world assets", "investment", "sustainability"],
  authors: [{ name: "AGV NEXRUR" }],
  openGraph: {
    title: "AGV NEXRUR - Investor Portal",
    description: "Access comprehensive documentation, financial models, and technical resources for AGV NEXRUR's innovative blockchain infrastructure.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
      <body
        className={`${inter.variable} ${poppins.variable} ${lato.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
