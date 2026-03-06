'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { locales, localeNames, localeFlags, type Locale } from '../../i18n';

interface LanguageSwitcherProps {
  currentLocale: Locale;
  className?: string;
}

export function LanguageSwitcher({ currentLocale, className }: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleLocaleChange = (locale: Locale) => {
    // Remove current locale from pathname
    const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(-[A-Z]{2})?/, '') || '/';
    
    // Set locale cookie for persistence
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=${60 * 60 * 24 * 365}`;
    
    // Navigate to new locale
    const newPath = `/${locale}${pathWithoutLocale}`;
    router.push(newPath);
    setIsOpen(false);
    
    // Force page reload to apply new locale
    window.location.href = newPath;
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
      >
        <span className="text-lg">{localeFlags[currentLocale]}</span>
        <span className="text-sm font-medium">{localeNames[currentLocale]}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-300 rounded-md shadow-lg z-50">
          {locales.map((locale) => (
            <button
              key={locale}
              onClick={() => handleLocaleChange(locale)}
              className={`w-full flex items-center space-x-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                locale === currentLocale ? 'bg-gray-100' : ''
              }`}
            >
              <span className="text-lg">{localeFlags[locale]}</span>
              <span className="text-sm">{localeNames[locale]}</span>
              {locale === currentLocale && (
                <span className="ml-auto text-xs text-gray-500">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

