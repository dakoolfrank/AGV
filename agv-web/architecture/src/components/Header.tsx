'use client';

import { ChangeEvent } from 'react';
import Image from 'next/image';
import { locales, localeNames, localeFlags, Locale } from '@/i18n';
import { useTranslation, useTranslations } from '@/lib/translation-provider';

export function Header() {
  const { locale, setLocale } = useTranslation();
  const { t } = useTranslations('header');

  const handleLocaleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setLocale(event.target.value as Locale);
  };

  return (
    <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-4">
          {/* Logo */}
          <div className="flex items-center">
            <div className="shrink-0 flex items-center">
              <Image
                src="/agv-logo.png"
                alt={t('protocolName')}
                width={32}
                height={32}
                className="mr-2 sm:mr-3"
              />
              <span className="text-xl sm:text-2xl font-bold text-white">{t('brand')}</span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 text-white">
            <label htmlFor="locale-picker" className="text-sm hidden sm:block">
              {t('languageLabel')}
            </label>
            <div className="relative">
              <span className="sr-only">{t('languageAriaLabel')}</span>
              <select
                id="locale-picker"
                value={locale}
                onChange={handleLocaleChange}
                className="appearance-none bg-black/90 border border-white/30 rounded-md px-3 py-1.5 pr-8 text-sm text-white backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                style={{ 
                  color: 'white',
                  backgroundColor: 'rgba(0, 0, 0, 0.9)'
                }}
                aria-label={t('languageAriaLabel')}
              >
                {locales.map(loc => (
                  <option 
                    key={loc} 
                    value={loc} 
                    style={{ 
                      backgroundColor: '#000', 
                      color: '#fff'
                    }}
                  >
                    {`${localeFlags[loc]} ${localeNames[loc]}`}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
