import { notFound } from 'next/navigation';
import { locales } from '../../../i18n';
import { AuthProvider } from '@/contexts/AuthContext';

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
  if (!locales.includes(locale as typeof locales[number])) {
    notFound();
  }

  return (
    <AuthProvider>
      <div className="relative flex min-h-screen flex-col">{children}</div>
    </AuthProvider>
  );
}
