'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Locale, defaultLocale, locales } from '@/i18n';
import enMessages from '@/messages/en.json';

type Messages = Record<string, any>;

interface TranslationContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  messages: Messages;
  isLoading: boolean;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}

// Translation hook for components
export function useTranslations(namespace?: string) {
  const { locale, messages } = useTranslation();
  
  const t = (key: string, params?: Record<string, string | number>): string => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    const keys = fullKey.split('.');
    
    let value = resolveValue(messages, keys);
    if (value === undefined && locale !== defaultLocale) {
      value = resolveValue(enMessages, keys);
    }
    if (typeof value !== 'string') {
      value = resolveValue(enMessages, keys);
    }
    if (typeof value !== 'string') {
      return fullKey;
    }
    
    // Replace parameters in the string
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey]?.toString() || match;
      });
    }
    
    return value;
  };
  
  return { t, locale };
}

interface TranslationProviderProps {
  children: ReactNode;
}

export function TranslationProvider({ children }: TranslationProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [messages, setMessages] = useState<Messages>(enMessages);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const savedLocale = localStorage.getItem('locale') as Locale | null;
    const browserLocale = detectBrowserLocale();
    const nextLocale = savedLocale && locales.includes(savedLocale)
      ? savedLocale
      : browserLocale ?? defaultLocale;
    if (nextLocale !== locale) {
      setLocaleState(nextLocale);
    }
  }, []);

  // Load messages when locale changes
  useEffect(() => {
    setIsLoading(true);
    const loadMessages = async () => {
      try {
        // Try to dynamically import the locale file
        let localeMessages;
        switch (locale) {
          case 'en':
            localeMessages = enMessages;
            break;
          case 'zh-CN':
            try {
              localeMessages = (await import('@/messages/zh-CN.json')).default;
            } catch {
              localeMessages = enMessages;
            }
            break;
          case 'zh-TW':
            try {
              localeMessages = (await import('@/messages/zh-TW.json')).default;
            } catch {
              localeMessages = enMessages;
            }
            break;
          case 'ko':
            try {
              localeMessages = (await import('@/messages/ko.json')).default;
            } catch {
              localeMessages = enMessages;
            }
            break;
          case 'tl':
            try {
              localeMessages = (await import('@/messages/tl.json')).default;
            } catch {
              localeMessages = enMessages;
            }
            break;
          case 'fr':
            try {
              localeMessages = (await import('@/messages/fr.json')).default;
            } catch {
              localeMessages = enMessages;
            }
            break;
          case 'de':
            try {
              localeMessages = (await import('@/messages/de.json')).default;
            } catch {
              localeMessages = enMessages;
            }
            break;
          case 'es':
            try {
              localeMessages = (await import('@/messages/es.json')).default;
            } catch {
              localeMessages = enMessages;
            }
            break;
          case 'ar':
            try {
              localeMessages = (await import('@/messages/ar.json')).default;
            } catch {
              localeMessages = enMessages;
            }
            break;
          case 'ja':
            try {
              localeMessages = (await import('@/messages/ja.json')).default;
            } catch {
              localeMessages = enMessages;
            }
            break;
          default:
            localeMessages = enMessages;
        }
        setMessages(localeMessages || enMessages || {});
        setIsLoading(false);
      } catch (error) {
        console.error(`Failed to load messages for locale ${locale}:`, error);
        // Fallback to English
        setMessages(enMessages || {});
        setIsLoading(false);
      }
    };
    
    loadMessages();
  }, [locale]);

  const setLocale = (newLocale: Locale) => {
    if (!locales.includes(newLocale)) return;
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', newLocale);
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return (
    <TranslationContext.Provider value={{ locale, setLocale, messages, isLoading }}>
      {children}
    </TranslationContext.Provider>
  );
}

function detectBrowserLocale(): Locale | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const language = navigator.language || navigator.languages?.[0];
  if (!language) return undefined;
  const exactMatch = locales.find(loc => loc.toLowerCase() === language.toLowerCase());
  if (exactMatch) {
    return exactMatch;
  }
  const languagePart = language.split('-')[0];
  return locales.find(loc => loc.split('-')[0] === languagePart);
}

function resolveValue(object: Messages, keys: string[]): unknown {
  return keys.reduce<unknown>((acc, currentKey) => {
    if (acc === undefined || acc === null) {
      return undefined;
    }
    
    // Handle array access (e.g., "features.0")
    if (Array.isArray(acc)) {
      const index = parseInt(currentKey, 10);
      if (!isNaN(index) && index >= 0 && index < acc.length) {
        return acc[index];
      }
      return undefined;
    }
    
    // Handle object access
    if (typeof acc === 'object' && currentKey in acc) {
      return (acc as Record<string, unknown>)[currentKey];
    }
    
    return undefined;
  }, object);
}

