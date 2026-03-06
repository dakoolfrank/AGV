'use client';

import { createContext, useContext, ReactNode } from 'react';

interface TranslationContextType {
  locale: string;
  messages: any;
  t: (key: string) => string;
  translateText: (text: string) => Promise<string>;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

interface TranslationProviderProps {
  locale: string;
  messages: any;
  children: ReactNode;
}

// Cache for AI translations to avoid re-translating
const translationCache = new Map<string, string>();

export function TranslationProvider({ locale, messages, children }: TranslationProviderProps) {
  
  const translateText = async (text: string): Promise<string> => {
    // Skip translation for English or if already in cache
    if (locale === 'en') return text;
    
    const cacheKey = `${locale}:${text}`;
    if (translationCache.has(cacheKey)) {
      return translationCache.get(cacheKey)!;
    }

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          from: 'en',
          to: locale
        })
      });

      if (response.ok) {
        const { text: translated } = await response.json();
        translationCache.set(cacheKey, translated);
        return translated;
      }
    } catch (error) {
      console.error('Translation error:', error);
    }
    
    return text; // Fallback to original text
  };

  const t = (key: string): any => {
    const keys = key.split('.');
    let value: any = messages;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // If key not found, return the key itself for component-level fallback
        return key;
      }
    }
    
    return value;
  };

  return (
    <TranslationContext.Provider value={{ locale, messages, t, translateText }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslations(namespace?: string) {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslations must be used within a TranslationProvider');
  }

  return (key: string): any => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    return context.t(fullKey);
  };
}
