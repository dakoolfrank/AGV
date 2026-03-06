import { ReactNode } from 'react';
import { TranslationProvider } from './TranslationProvider';
import { Navbar } from '@/components/Navbar';
import '../globals.css';
import { locales } from '@/i18n';

async function getMessages(locale: string) {
  try {
    return (await import(`@/messages/${locale}.json`)).default;
  } catch {
    return (await import(`@/messages/en.json`)).default;
  }
}

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;
  const messages = await getMessages(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="antialiased">
        <TranslationProvider locale={locale} messages={messages}>
          <div className="min-h-screen bg-background">
            <Navbar />
            {children}
          </div>
        </TranslationProvider>
      </body>
    </html>
  );
}
