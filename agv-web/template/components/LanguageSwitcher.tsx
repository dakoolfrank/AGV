'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Globe, ChevronDown } from 'lucide-react';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n';
import { cn } from '@/lib/utils';

export function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get current locale from pathname
  const pathSegments = pathname.split('/').filter(Boolean);
  const currentLocale = (pathSegments[0] && locales.includes(pathSegments[0] as Locale))
    ? (pathSegments[0] as Locale)
    : 'en';

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center space-x-2 px-3 py-2 rounded-md border border-border",
          "bg-background hover:bg-accent hover:text-accent-foreground",
          "transition-colors text-sm font-medium",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        )}
        aria-label="Change language"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{localeFlags[currentLocale]}</span>
        <span className="hidden md:inline">{localeNames[currentLocale]}</span>
        <ChevronDown className={cn(
          "h-4 w-4 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-md shadow-lg z-50 overflow-hidden">
          <div className="py-1">
            {locales.map((locale) => (
              <button
                key={locale}
                onClick={() => handleLocaleChange(locale)}
                className={cn(
                  "w-full flex items-center space-x-3 px-4 py-2 text-sm",
                  "hover:bg-accent hover:text-accent-foreground",
                  "transition-colors cursor-pointer",
                  locale === currentLocale && "bg-accent text-accent-foreground"
                )}
              >
                <span className="text-lg">{localeFlags[locale]}</span>
                <span className="flex-1 text-left">{localeNames[locale]}</span>
                {locale === currentLocale && (
                  <span className="text-primary">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
