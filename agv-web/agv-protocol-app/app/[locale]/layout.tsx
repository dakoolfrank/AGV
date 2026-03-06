// app/[locale]/layout.tsx
import { notFound } from 'next/navigation';
import { locales } from '@/i18n';
import { Inter } from 'next/font/google';
import '../globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  
  // Validate locale
  if (!locales.includes(locale as any)) {
    notFound();
  }

  return (
    <html lang={locale} suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Optional prefetches */}
        <link rel="prefetch" href={`/${locale}/admin`} />
        <link rel="prefetch" href={`/${locale}/kol`} />
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <div className="relative flex min-h-screen flex-col">{children}</div>
      </body>
    </html>
  );
}
