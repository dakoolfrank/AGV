// components/ui/header-with-language-switcher.tsx
'use client';

import { LanguageSwitcher } from './language-switcher';
import { useTranslations } from '@/hooks/useTranslations';

interface HeaderWithLanguageSwitcherProps {
  children?: React.ReactNode;
  className?: string;
}

export function HeaderWithLanguageSwitcher({ 
  children, 
  className = '' 
}: HeaderWithLanguageSwitcherProps) {
  const { t, locale } = useTranslations();

  return (
    <header className={`flex items-center justify-between p-4 border-b ${className}`}>
      <div className="flex items-center space-x-4">
        {/* Logo or brand */}
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">AGV</span>
          </div>
          <span className="text-xl font-bold text-gray-900">AGV Protocol</span>
        </div>
        
        {/* Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <a href={`/${locale}/landing`} className="text-gray-600 hover:text-blue-600 transition-colors">
            {t('nav.home')}
          </a>
          <a href={`/${locale}/blog`} className="text-gray-600 hover:text-blue-600 transition-colors">
            {t('nav.blog')}
          </a>
          <a href={`/${locale}/staking`} className="text-gray-600 hover:text-blue-600 transition-colors">
            {t('nav.staking')}
          </a>
          <a href={`/${locale}/mint`} className="text-gray-600 hover:text-blue-600 transition-colors">
            {t('nav.mint')}
          </a>
        </nav>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Language Switcher */}
        <LanguageSwitcher />
        
        {/* Additional header content */}
        {children}
      </div>
    </header>
  );
}
