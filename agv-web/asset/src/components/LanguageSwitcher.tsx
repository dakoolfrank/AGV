'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { locales, localeNames, localeFlags, type Locale } from '../../i18n';
import { Button } from './ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from './ui/dropdown-menu';
import { Globe } from 'lucide-react';

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
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={`${className} hover:bg-accent hover:text-accent-foreground`}
        >
          <Globe className="h-4 w-4 mr-2" />
          {localeFlags[currentLocale]} {localeNames[currentLocale]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 z-[100] bg-white border border-gray-200 shadow-lg">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleLocaleChange(locale)}
            className={`flex items-center space-x-2 text-gray-900 hover:bg-gray-100 hover:text-gray-900 ${
              locale === currentLocale ? 'bg-blue-50 text-blue-900' : ''
            }`}
          >
            <span className="text-lg">{localeFlags[locale]}</span>
            <span className="text-gray-900">{localeNames[locale]}</span>
            {locale === currentLocale && (
              <span className="ml-auto text-xs text-blue-600">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
