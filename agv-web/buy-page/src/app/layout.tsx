import type { Metadata } from "next";
import { Geist, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PreGVT Token - Pre-Token Buy Page",
  description: "Join the PreGVT token presale. Limited time opportunity to get early access to the next generation token.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ backgroundColor: '#000000' }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ backgroundColor: '#000000' }}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
