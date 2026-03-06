'use client';

import { useParams } from 'next/navigation';
import { getTranslation, hasTranslation } from '../../lib/translations';
import { Locale } from '../../i18n';

export function useTranslations() {
  const params = useParams();
  const locale = (params?.locale as Locale) || 'en';

  const t = (key: string): string => {
    try {
      return getTranslation(locale, key);
    } catch (error) {
      console.warn('Translation error:', error);
      return key;
    }
  };

  const hasT = (key: string): boolean => {
    try {
      return hasTranslation(locale, key);
    } catch {
      return false;
    }
  };

  return {
    t,
    hasT,
    locale,
  };
}
