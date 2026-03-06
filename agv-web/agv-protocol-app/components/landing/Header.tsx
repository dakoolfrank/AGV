"use client";
import React from "react";
import { WalletConnect } from "@/components/wallet/wallet-connect";
import { FastLink } from "../ui/fast-link";
import { LanguageSwitcher } from "../ui/language-switcher";
import { useTranslations } from "@/hooks/useTranslations";
import Image from "next/image"

export const Header: React.FC = () => {
  const { t, locale } = useTranslations();
  
  return (
    <header className="sticky top-0 z-50 bg-[#3399FF] px-4 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <FastLink href={`/${locale}/landing`} className="flex items-center space-x-2">
            <Image
              src="/logo.png"
              alt="AGV Protocol"
              width={32}
              height={32}
              className="rounded-lg"
            />
          </FastLink>
          <span className="text-white font-semibold text-sm sm:text-lg">AGRIVOLT PROTOCOL</span>
        </div>

        {/* Navigation */}
        <nav className="hidden lg:flex items-center space-x-6 xl:space-x-8">
          <a href={`/${locale}/landing`} className="text-white hover:text-white/80 transition-colors text-sm xl:text-base">{t('nav.home')}</a>
          <a href={`/${locale}/about`} className="text-white hover:text-white/80 transition-colors text-sm xl:text-base">{t('nav.about')}</a>
          <a href={`/${locale}/career`} className="text-white hover:text-white/80 transition-colors text-sm xl:text-base">{t('nav.career')}</a>
          <a href={`/${locale}/blog`} className="text-white hover:text-white/80 transition-colors text-sm xl:text-base">{t('nav.blog')}</a>
          <a href={`https://investor.agvprotocol.org/en`} className="text-white hover:text-white/80 transition-colors text-sm xl:text-base">{t('nav.investors')}</a>
          <a href={`/${locale}/whitelist`} className="text-white hover:text-white/80 transition-colors text-sm xl:text-base font-semibold bg-white/20 px-3 py-1 rounded-full">Join Whitelist</a>
        </nav>

        {/* Right side - Language Switcher and Wallet Connect */}
        <div className="flex items-center space-x-4">
          <LanguageSwitcher className="bg-white/10 hover:bg-white/20 text-white border-white/20" />
          <WalletConnect />
        </div>
      </div>
    </header>
  );
};
