"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FastLink } from "../ui/fast-link";
import { Button } from "../ui/button";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "@/app/[locale]/TranslationProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LogIn } from "lucide-react";

export const Header: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('header');

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };


  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <FastLink href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 relative">
              <Image 
                src="/logo.png" 
                alt="G3 Fund Logo" 
                fill
                className="object-contain"
              />
            </div>
          </FastLink>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center space-x-6 xl:space-x-8">
          <Link href="/" className={`hover:opacity-80 transition-colors text-sm xl:text-base text-primary ${pathname === "/" ? "underline underline-offset-4" : ""}`}>
            {t('nav.home')}
          </Link>
          <Link href="/fund" className={`hover:opacity-80 transition-colors text-sm xl:text-base text-primary ${pathname === "/fund" ? "underline underline-offset-4" : ""}`}>
            {t('nav.fund')}
          </Link>
          <Link href="/community" className={`hover:opacity-80 transition-colors text-sm xl:text-base text-primary ${pathname === "/community" ? "underline underline-offset-4" : ""}`}>
            {t('nav.community')}
          </Link>
          <Link href="/join" className={`hover:opacity-80 transition-colors text-sm xl:text-base text-primary ${pathname === "/join" ? "underline underline-offset-4" : ""}`}>
            {t('nav.joinSocialMining')}
          </Link>
          <Link href="/institutions" className={`hover:opacity-80 transition-colors text-sm xl:text-base text-primary ${pathname === "/institutions" ? "underline underline-offset-4" : ""}`}>
            {t('nav.institutions')}
          </Link>
        </nav>

        {/* Desktop Dashboard Button and Language Switcher */}
        <div className="hidden lg:flex items-center space-x-4">
          <LanguageSwitcher currentLocale={pathname.split('/')[1] as 'en' | 'zh-CN' | 'zh-TW' | 'ko' | 'tl' | 'fr' | 'de' | 'es' | 'ar' | 'ja'} />
          <Button 
            onClick={() => router.push('/kol-dashboard')}
            className="transition-all duration-300 hover:bg-primary hover:text-white flex items-center space-x-2"
          >
            <LogIn className="h-4 w-4" />
            <span>{t('dashboard')}</span>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={toggleMobileMenu}
          className="lg:hidden p-2 rounded-lg transition-colors text-primary hover:bg-primary/10"
          aria-label="Toggle mobile menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isMobileMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg">
          <nav className="px-4 py-6 space-y-4">
            <Link 
              href="/" 
              onClick={closeMobileMenu}
              className="block py-2 text-base font-medium transition-colors text-primary hover:text-primary/80"
            >
              {t('nav.home')}
            </Link>
            <Link 
              href="/fund" 
              onClick={closeMobileMenu}
              className="block py-2 text-base font-medium transition-colors text-primary hover:text-primary/80"
            >
              {t('nav.fund')}
            </Link>
            <Link 
              href="/community" 
              onClick={closeMobileMenu}
              className="block py-2 text-base font-medium transition-colors text-primary hover:text-primary/80"
            >
              {t('nav.community')}
            </Link>
            <Link 
              href="/join" 
              onClick={closeMobileMenu}
              className="block py-2 text-base font-medium transition-colors text-primary hover:text-primary/80"
            >
              {t('nav.joinSocialMining')}
            </Link>
            <Link 
              href="/institutions" 
              onClick={closeMobileMenu}
              className="block py-2 text-base font-medium transition-colors text-primary hover:text-primary/80"
            >
              {t('nav.institutions')}
            </Link>
            <div className="pt-4 border-t border-gray-200 space-y-4">
              <LanguageSwitcher currentLocale={pathname.split('/')[1] as 'en' | 'zh-CN' | 'zh-TW' | 'ko' | 'tl' | 'fr' | 'de' | 'es' | 'ar' | 'ja'} />
              <Button 
                onClick={() => {
                  closeMobileMenu();
                  router.push('/kol-dashboard');
                }}
                className="w-full transition-all duration-300 flex items-center justify-center space-x-2"
              >
                <LogIn className="h-4 w-4" />
                <span>{t('dashboard')}</span>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
