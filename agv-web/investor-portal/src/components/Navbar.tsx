'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './Button';
import { useTranslations } from '@/hooks/useTranslations';
import { LanguageSwitcher } from './LanguageSwitcher';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t, locale } = useTranslations();

  const navigation = [
    { name: t('nav.tech'), href: `/${locale}/tech` },
    { name: t('nav.financials'), href: `/${locale}/financials` },
    { name: t('nav.legal'), href: `/${locale}/legal` },
    { name: t('nav.esg'), href: `/${locale}/esg` },
    { name: t('nav.depin'), href: `/${locale}/depin` },
    { name: t('nav.brandkit'), href: `/${locale}/brandkit` },
    { name: t('nav.contact'), href: `/${locale}/contact` },
  ];

  return (
    <nav className="bg-white/95 backdrop-blur-sm border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href={`/${locale}`} className="flex items-center space-x-2">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="w-8 h-8 flex items-center justify-center"
            >
              <Image 
                src="/logo.png" 
                alt="AGV NEXRUR Logo" 
                width={32}
                height={32}
                className="w-full h-full object-contain"
              />
            </motion.div>
            <span className="text-xl font-semibold text-foreground">AGV NEXRUR</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors duration-200 font-medium"
              >
                {item.name}
              </Link>
            ))}
            <Button href={`/${locale}/investor`} variant="primary" size="sm">
              {t('investor.dashboard')}
            </Button>
            <LanguageSwitcher currentLocale={locale} />
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-border"
            >
              <div className="py-4 space-y-2">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="block px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}
                <div className="px-3 pt-2 space-y-2">
                  <Button href={`/${locale}/register`} variant="outline" size="sm" className="w-full">
                    Request Access
                  </Button>
                  <Button href={`/${locale}/investor`} variant="primary" size="sm" className="w-full">
                    {t('investor.dashboard')}
                  </Button>
                  <LanguageSwitcher currentLocale={locale} className="w-full" />
                </div>
                
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
