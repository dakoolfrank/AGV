'use client';

import { Locale } from '@/i18n';

// Cache for loaded translations
const translationCache = new Map<Locale, Record<string, any>>();

// Load translations dynamically
async function loadTranslations(locale: Locale): Promise<Record<string, any>> {
  // Return cached translations if available
  if (translationCache.has(locale)) {
    return translationCache.get(locale)!;
  }

  try {
    const response = await fetch(`/messages/${locale}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load translations for ${locale}`);
    }
    
    const translations = await response.json();
    
    // Cache the translations
    translationCache.set(locale, translations);
    
    return translations;
  } catch (error) {
    console.error(`Failed to load translations for ${locale}:`, error);
    
    // Fallback to English
    if (locale !== 'en') {
      return loadTranslations('en');
    }
    
    return {};
  }
}

// Get translation with fallback
export function getTranslation(locale: Locale, key: string): string {
  const translations = translationCache.get(locale);
  
  if (!translations) {
    // Load translations synchronously if not cached
    loadTranslations(locale).then(() => {
      // Trigger re-render by updating cache
      const cached = translationCache.get(locale);
      if (cached) {
        const value = getNestedValue(cached, key);
        if (value !== undefined) {
          return value;
        }
      }
    });
    
    return key; // Return key as fallback
  }
  
  const value = getNestedValue(translations, key);
  return value !== undefined ? value : key;
}

// Check if translation exists
export function hasTranslation(locale: Locale, key: string): boolean {
  const translations = translationCache.get(locale);
  
  if (!translations) {
    return false;
  }
  
  const value = getNestedValue(translations, key);
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

// Preload translations for better performance
export async function preloadTranslations(locale: Locale): Promise<void> {
  if (!translationCache.has(locale)) {
    await loadTranslations(locale);
  }
}
