// app/[locale]/page.tsx
import { redirect } from 'next/navigation';
import { defaultLocale } from '@/i18n';

interface LocalePageProps {
  params: Promise<{ locale: string }>;
}

export default async function LocalePage({ params }: LocalePageProps) {
  // This page should not be reached due to middleware redirect
  // But if it is, redirect to the landing page
  const { locale } = await params;
  redirect(`/${locale}/landing`);
}
