import { Locale } from '@/i18n';

// Import all translation files
import enTranslations from '../messages/en.json';
import zhCNTranslations from '../messages/zh-CN.json';
import zhTWTranslations from '../messages/zh-TW.json';
import koTranslations from '../messages/ko.json';
import tlTranslations from '../messages/tl.json';
import frTranslations from '../messages/fr.json';
import deTranslations from '../messages/de.json';
import esTranslations from '../messages/es.json';
import arTranslations from '../messages/ar.json';
import jaTranslations from '../messages/ja.json';

// Translation map
const translations: Record<Locale, Record<string, any>> = {
  en: enTranslations,
  'zh-CN': zhCNTranslations,
  'zh-TW': zhTWTranslations,
  ko: koTranslations,
  tl: tlTranslations,
  fr: frTranslations,
  de: deTranslations,
  es: esTranslations,
  ar: arTranslations,
  ja: jaTranslations,
};

// Get translation with fallback
export function getTranslation(locale: Locale, key: string): string {
  const localeTranslations = translations[locale] || translations.en;
  const value = getNestedValue(localeTranslations, key);
  return value !== undefined ? value : key;
}

// Check if translation exists
export function hasTranslation(locale: Locale, key: string): boolean {
  const localeTranslations = translations[locale] || translations.en;
  const value = getNestedValue(localeTranslations, key);
  return value !== undefined;
}

// Helper to get nested object values
function getNestedValue(obj: Record<string, any>, key: string): string | undefined {
  const keys = key.split('.');
  let current = obj;
  
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      return undefined;
    }
  }
  
  return typeof current === 'string' ? current : undefined;
}
