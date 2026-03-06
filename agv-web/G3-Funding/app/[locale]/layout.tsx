import { ReactNode } from 'react';
import { TranslationProvider } from './TranslationProvider';
import { AuthProvider } from '@/lib/auth-context';

const supportedLocales = ['en', 'zh-CN', 'zh-TW', 'ko', 'tl', 'fr', 'de', 'es', 'ar', 'ja'];

async function getMessages(locale: string) {
  try {
    return (await import(`@/messages/${locale}.json`)).default;
  } catch {
    return (await import(`@/messages/en.json`)).default;
  }
}

export async function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
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
    <TranslationProvider locale={locale} messages={messages}>
      <AuthProvider>
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </AuthProvider>
    </TranslationProvider>
  );
}
