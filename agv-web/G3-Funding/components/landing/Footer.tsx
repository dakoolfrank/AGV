"use client";

import React from "react";
import { Check, Zap, Link2, MessageCircle, Twitter, Send, Github } from "lucide-react";
import { FastLink } from "../ui/fast-link";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "@/app/[locale]/TranslationProvider";

export const Footer: React.FC = () => {
  const t = useTranslations('footer');
  
  return (
    <footer className="relative bg-primary text-white overflow-hidden">
      {/* Circular Overlay */}
        <div className="absolute bottom-0 left-4 sm:left-6 lg:left-8 w-80 h-80 sm:w-96 sm:h-96 lg:w-[1000px] lg:h-[1000px] bg-gradient-to-br from-transparent to-[#6f7fa3] rounded-full opacity-30 transform -translate-x-1/2 translate-y-1/2"></div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 mb-8 sm:mb-12">
          {/* Left Section - Company Information */}
          <div className="space-y-4 sm:space-y-6">
            {/* Logo */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <FastLink href="/" className="flex items-center space-x-2">
                <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center p-2">
                  <Image 
                    src="/logo.png" 
                    alt="G3 Fund Logo" 
                    width={48}
                    height={48}
                    className="object-contain"
                  />
                </div>
              </FastLink>
              <span className="text-white font-semibold text-sm sm:text-lg">
                {t('companyName')} <br />
                {t('tagline')}
              </span>
            </div>
            {/* Description */}
            <p className="text-white/90 leading-relaxed max-w-lg text-sm sm:text-base">
              {t('description')}
            </p>
            
            {/* Feature Highlights */}
            <div className="flex flex-wrap gap-3 sm:gap-4 lg:gap-6">
              <div className="flex items-center space-x-2">
                <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                <span className="text-white text-xs sm:text-sm font-medium">
                  {t('features.secure')}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                <span className="text-white text-xs sm:text-sm font-medium">
                  {t('features.fast')}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Link2 className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                <span className="text-white text-xs sm:text-sm font-medium">
                  {t('features.multichain')}
                </span>
              </div>
            </div>
          </div>
          
          {/* Right Section - Navigation Links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {/* Product Column */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-white font-bold text-base sm:text-lg">
                {t('sections.platform.title')}
              </h3>
              <ul className="space-y-1 sm:space-y-2">
                <li><Link href="/fund" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">
                  {t('sections.platform.fundStructure')}
                </Link></li>
                <li><Link href="/community" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">
                  {t('sections.platform.community')}
                </Link></li>
                <li><Link href="/coming-soon" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">
                  {t('sections.platform.kolProgram')}
                </Link></li>
                <li><Link href="/coming-soon" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">
                  {t('sections.platform.referralSystem')}
                </Link></li>
              </ul>
            </div>
            
            {/* Company Column */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-white font-bold text-base sm:text-lg">
                {t('sections.resources.title')}
              </h3>
              <ul className="space-y-1 sm:space-y-2">
                <li><Link href="/coming-soon" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">
                  {t('sections.resources.aboutG3')}
                </Link></li>
                <li><Link href="/coming-soon" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">
                  {t('sections.resources.rwaEducation')}
                </Link></li>
                <li><Link href="/coming-soon" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">
                  {t('sections.resources.trainingPrograms')}
                </Link></li>
                <li><Link href="/coming-soon" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">
                  {t('sections.resources.blog')}
                </Link></li>
              </ul>
            </div>
            
            {/* Support Column */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-white font-bold text-base sm:text-lg">
                {t('sections.support.title')}
              </h3>
              <ul className="space-y-1 sm:space-y-2">
                <li><Link href="/coming-soon" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">
                  {t('sections.support.helpCenter')}
                </Link></li>
                <li><Link href="/coming-soon" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">
                  {t('sections.support.kolGuidelines')}
                </Link></li>
                <li><Link href="/coming-soon" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">
                  {t('sections.support.communityRules')}
                </Link></li>
                <li><Link href="/coming-soon" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">
                  {t('sections.support.contactSupport')}
                </Link></li>
              </ul>
            </div>
            
            {/* Legal Column */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-white font-bold text-base sm:text-lg">
                {t('sections.legal.title')}
              </h3>
              <ul className="space-y-1 sm:space-y-2">
                <li><Link href="/coming-soon" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">
                  {t('sections.legal.privacyPolicy')}
                </Link></li>
                <li><Link href="/coming-soon" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">
                  {t('sections.legal.termsOfService')}
                </Link></li>
                <li><Link href="/coming-soon" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">
                  {t('sections.legal.cookiePolicy')}
                </Link></li>
                <li><Link href="/coming-soon" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">
                  {t('sections.legal.gdpr')}
                </Link></li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Bottom Section - Social Media & Copyright */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 mb-8 sm:mb-12">
          {/* Legal/Operational Details */}
          <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-white/80">
            <p>
              {t('disclaimer.operational')}
            </p>
            <p>
              {t('disclaimer.risk')}
            </p>
          </div>

          <div className="flex flex-col items-end justify-content-end">
            {/* Social Media Icons */}
            <div className="flex items-center space-x-2 sm:space-x-3 mb-4">
              <a href="https://discord.gg/JP9RtzM2SC" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 border border-white rounded-lg flex items-center justify-center hover:bg-white/90 transition-colors">
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </a>
              <a href="https://x.com/AgvProtocol" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 border border-white rounded-lg flex items-center justify-center hover:bg-white/90 transition-colors">
                <Twitter className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </a>
              <a href="https://github.com/AGV-Protocol/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 border border-white rounded-lg flex items-center justify-center hover:bg-white/90 transition-colors">
                <Github className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </a>
              <a href="https://t.me/agvprotocol" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 border border-white rounded-lg flex items-center justify-center hover:bg-white/90 transition-colors">
                <Send className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </a>
            </div>

            {/* Copyright */}
            <p className="text-white/80 text-xs sm:text-sm">
              {t('copyright')}
            </p>
          </div>
          
        </div>
      </div>
    </footer>
  );
};
