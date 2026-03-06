'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Locale, defaultLocale, locales } from '@/i18n';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

// Import messages statically - Next.js will handle this
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
    
    let value: any = messages;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English if key not found
        if (locale !== defaultLocale) {
          // Try to get from default locale as fallback
          return fullKey;
        }
        return fullKey;
      }
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
  const [messages, setMessages] = useState<Messages>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load locale from localStorage on mount
  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') as Locale;
    if (savedLocale && locales.includes(savedLocale)) {
      setLocaleState(savedLocale);
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
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    // Update HTML lang attribute
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
    }
  };

  return (
    <TranslationContext.Provider value={{ locale, setLocale, messages, isLoading }}>
      <LoadingScreen isLoading={isLoading} />
      {!isLoading && (
        <div style={{ animation: 'fadeIn 0.3s ease-in-out forwards' }}>
          {children}
        </div>
      )}
    </TranslationContext.Provider>
  );
}

