'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { WalletConnect } from './WalletConnect';
import { useTranslations, useTranslation } from '@/lib/translation-provider';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useTranslations('header');
  const { locale, setLocale } = useTranslation();

  const navLinks = [
    { href: '/', key: 'nav.home' },
    { href: '/claim', key: 'nav.claim' },
    { href: '/buy', key: 'nav.buy' },
    { href: '/balance', key: 'nav.balance' },
    { href: '/staking', key: 'nav.staking' },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="shrink-0 flex items-center">
              <Image
                src="/agv-logo.png"
                alt="AGV Protocol"
                width={32}
                height={32}
                className="mr-2 sm:mr-3"
              />
              <span className="text-xl sm:text-2xl font-bold text-white">PreGVT</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`relative text-white hover:text-blue-200 px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(link.href) ? 'border-b-2 border-white' : ''
                }`}
              >
                {t(link.key)}
              </a>
            ))}
          </nav>

          {/* Language Selector & Auth Buttons */}
          <div className="hidden sm:flex items-center space-x-4">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
                className="flex items-center space-x-2 text-white hover:text-blue-200 px-3 py-2 text-sm font-medium transition-colors"
              >
                <span>{localeFlags[locale]}</span>
                <span className="hidden md:inline">{localeNames[locale]}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {isLanguageMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsLanguageMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-black/95 backdrop-blur-md border border-white/20 rounded-lg shadow-xl z-50 overflow-hidden">
                    {locales.map((loc) => (
                      <button
                        key={loc}
                        onClick={() => {
                          setLocale(loc);
                          setIsLanguageMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center space-x-2 ${
                          locale === loc
                            ? 'bg-blue-600 text-white'
                            : 'text-white hover:bg-white/10'
                        }`}
                      >
                        <span>{localeFlags[loc]}</span>
                        <span>{localeNames[loc]}</span>
                        {locale === loc && (
                          <span className="ml-auto">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            
            {/* Wallet Connect */}
            <WalletConnect />
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-white hover:text-blue-200 p-2"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-white/10 backdrop-blur-sm rounded-lg mt-2">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={`block text-white hover:text-blue-200 px-3 py-2 text-base font-medium ${
                    isActive(link.href) ? 'border-l-2 border-white' : ''
                  }`}
                >
                  {t(link.key)}
                </a>
              ))}
              <a href="#about" className="block text-white hover:text-blue-200 px-3 py-2 text-base font-medium">
                {t('nav.about')}
              </a>
              <a href="#whitepaper" className="block text-white hover:text-blue-200 px-3 py-2 text-base font-medium">
                {t('nav.whitepaper')}
              </a>
              
              {/* Mobile Language Selector */}
              <div className="pt-4 border-t border-white/20 px-3">
                <div className="space-y-2">
                  <p className="text-white/70 text-sm mb-2">{t('selectLanguage')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {locales.map((loc) => (
                      <button
                        key={loc}
                        onClick={() => {
                          setLocale(loc);
                          setIsMenuOpen(false);
                        }}
                        className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                          locale === loc
                            ? 'bg-blue-600 text-white'
                            : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                      >
                        <span>{localeFlags[loc]}</span>
                        <span>{localeNames[loc]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Mobile Wallet Connect */}
              <div className="pt-4 border-t border-white/20">
                <div className="flex justify-center">
                  <WalletConnect />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
