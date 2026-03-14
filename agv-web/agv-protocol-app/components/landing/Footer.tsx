"use client";
import React from "react";
import { Check, Zap, Link2, MessageCircle, Twitter, Send, Github } from "lucide-react";
import { FastLink } from "../ui/fast-link";
import { useTranslations } from "@/hooks/useTranslations";
import Link from "next/link";
import Image from "next/image"

export const Footer: React.FC = () => {
  const { t, locale } = useTranslations();
  
  return (
    <footer className="relative bg-[#3399FF] text-white overflow-hidden">
      {/* Circular Overlay */}
        <div className="absolute bottom-0 left-4 sm:left-6 lg:left-8 w-80 h-80 sm:w-96 sm:h-96 lg:w-[1000px] lg:h-[1000px] bg-gradient-to-br from-transparent to-[#99DDFF] rounded-full opacity-30 transform -translate-x-1/2 translate-y-1/2"></div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 mb-8 sm:mb-12">
          {/* Left Section - Company Information */}
          <div className="space-y-4 sm:space-y-6">
            {/* Logo */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <FastLink href="/" className="flex items-center space-x-2">
                <Image
                  src="/footer-logo.png"
                  alt="AGV NEXRUR"
                  width={100}
                  height={100}
                  className="rounded-lg"
                />
              </FastLink>
              <span className="text-white font-semibold text-sm sm:text-lg">AGRIVOLT <br />PROTOCOL
              <br />
                NFT Minting Platform</span>
            </div>
            {/* Description */}
            <p className="text-white/90 leading-relaxed max-w-lg text-sm sm:text-base">
              {t('footer.description')}
            </p>
            
            {/* Feature Highlights */}
            <div className="flex flex-wrap gap-3 sm:gap-4 lg:gap-6">
              <div className="flex items-center space-x-2">
                <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                <span className="text-white text-xs sm:text-sm font-medium">{t('footer.secure')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                <span className="text-white text-xs sm:text-sm font-medium">{t('footer.fast')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Link2 className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                <span className="text-white text-xs sm:text-sm font-medium">{t('footer.multichain')}</span>
              </div>
            </div>
          </div>
          
          {/* Right Section - Navigation Links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {/* Product Column */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-white font-bold text-base sm:text-lg">{t('footer.resources')}</h3>
              <ul className="space-y-1 sm:space-y-2">
                <li><Link href={`/${locale}/mint`} className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t('footer.nftMinting')}</Link></li>
                <li><Link href={`/${locale}/staking`} className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t('footer.nftStaking')}</Link></li>
                <li><Link href={`/${locale}/coming-soon`} className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t('footer.kolProgram')}</Link></li>
              </ul>
            </div>
            
            {/* Company Column */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-white font-bold text-base sm:text-lg">{t('footer.company')}</h3>
              <ul className="space-y-1 sm:space-y-2">
                <li><Link href={`/${locale}/coming-soon`} className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t('footer.aboutUs')}</Link></li>
                <li><Link href={`/${locale}/career`} className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t('footer.careers')}</Link></li>
                <li><Link href={`/${locale}/blog`} className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t('footer.blogs')}</Link></li>
              </ul>
            </div>
            
            {/* Support Column */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-white font-bold text-base sm:text-lg">{t('footer.support')}</h3>
              <ul className="space-y-1 sm:space-y-2">
                <li><Link href={`/${locale}/coming-soon`} className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t('footer.helpCenter')}</Link></li>
                <li><Link href={`/${locale}/coming-soon`} className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t('footer.documentation')}</Link></li>
                <li><Link href={`/${locale}/coming-soon`} className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t('footer.contactSupport')}</Link></li>
              </ul>
            </div>
            
            {/* Legal Column */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-white font-bold text-base sm:text-lg">{t('footer.legal')}</h3>
              <ul className="space-y-1 sm:space-y-2">
                <li><Link href={`/${locale}/coming-soon`} className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t('footer.privacy')}</Link></li>
                <li><Link href={`/${locale}/coming-soon`} className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t('footer.terms')}</Link></li>
                <li><Link href={`/${locale}/coming-soon`} className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t('footer.cookiePolicy')}</Link></li>
                <li><Link href={`/${locale}/coming-soon`} className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t('footer.gdpr')}</Link></li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Bottom Section - Social Media & Copyright */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 mb-8 sm:mb-12">
          {/* Legal/Operational Details */}
          <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-white/80">
            <p>{t('footer.headquarters')}</p>
            <p>
              {t('footer.legalText')}
            </p>
          </div>

          <div className="flex flex-col items-end justify-content-end">
            {/* Social Media Icons */}
            <div className="flex items-center space-x-2 sm:space-x-3 mb-4">
              <a href="https://discord.gg/mJKTyqWtKe" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 border border-white rounded-lg flex items-center justify-center hover:bg-white/90 transition-colors">
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </a>
              <a href="https://x.com/agvnexrur" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 border border-white rounded-lg flex items-center justify-center hover:bg-white/90 transition-colors">
                <Twitter className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </a>
              <a href="https://github.com/dakoolfrank/AGV" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 border border-white rounded-lg flex items-center justify-center hover:bg-white/90 transition-colors">
                <Github className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </a>
              <a href="https://t.me/agvnexrur_bot" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 border border-white rounded-lg flex items-center justify-center hover:bg-white/90 transition-colors">
                <Send className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </a>
            </div>

            {/* Copyright */}
            <p className="text-white/80 text-xs sm:text-sm">{t('footer.copyright')}</p>
          </div>
          
        </div>
      </div>
    </footer>
  );
};
