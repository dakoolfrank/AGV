import { readFileSync } from 'fs';
import { join } from 'path';
import { defaultLocale, type Locale } from '../i18n';

// Cache for loaded translations
const translationCache = new Map<Locale, Record<string, unknown>>();

export function getTranslations(locale: Locale): Record<string, unknown> {
  // Return cached translations if available
  if (translationCache.has(locale)) {
    return translationCache.get(locale)!;
  }

  try {
    const messagesPath = join(process.cwd(), 'messages', `${locale}.json`);
    const translations = JSON.parse(readFileSync(messagesPath, 'utf-8'));

    // Cache the translations
    translationCache.set(locale, translations);

    return translations;
  } catch (error) {
    console.error(`Failed to load translations for ${locale}:`, error);

    // Fallback to default locale
    if (locale !== defaultLocale) {
      return getTranslations(defaultLocale);
    }

    // If even default locale fails, return empty object
    return {};
  }
}

export function getTranslation(locale: Locale, key: string): string {
  const translations = getTranslations(locale);

  // Navigate through nested object using dot notation
  const keys = key.split('.');
  let value: unknown = translations;

  for (const k of keys) {
    if (value && typeof value === 'object' && value !== null && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      // Key not found, try fallback to default locale
      if (locale !== defaultLocale) {
        return getTranslation(defaultLocale, key);
      }

      // If even default locale doesn't have the key, return the key itself
      console.warn(`Translation key not found: ${key} for locale: ${locale}`);
      return key;
    }
  }

  return typeof value === 'string' ? value : key;
}

export function hasTranslation(locale: Locale, key: string): boolean {
  const translations = getTranslations(locale);

  const keys = key.split('.');
  let value: unknown = translations;

  for (const k of keys) {
    if (value && typeof value === 'object' && value !== null && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return false;
    }
  }

  return typeof value === 'string';
}

