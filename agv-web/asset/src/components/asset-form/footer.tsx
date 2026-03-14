"use client";

import React from "react";
import { Check, Zap, Link2, MessageCircle, Twitter, Send, Github } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "../../hooks/useTranslations";

export function AssetFormFooter() {
  const { t } = useTranslations();
  return (
    <footer className="relative bg-[#3399FF] text-white overflow-hidden mt-16">
      {/* Circular Overlay */}
      <div className="absolute bottom-0 left-4 sm:left-6 lg:left-8 w-80 h-80 sm:w-96 sm:h-96 lg:w-[1000px] lg:h-[1000px] bg-gradient-to-br from-transparent to-[#99DDFF] rounded-full opacity-30 transform -translate-x-1/2 translate-y-1/2"></div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 mb-8 sm:mb-12">
          {/* Left Section - Company Information */}
          <div className="space-y-4 sm:space-y-6">
            {/* Logo */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="flex items-center space-x-2">
                <Image
                  src="/footer-logo.png"
                  alt="AGV NEXRUR"
                  width={100}
                  height={100}
                  className="rounded-lg"
                />
              </div>
              <span className="text-white font-semibold text-sm sm:text-lg">{t("footer.title")}</span>
            </div>
            {/* Description */}
            <p className="text-white/90 leading-relaxed max-w-lg text-sm sm:!text-base">
              {t("footer.description")}
            </p>
            
            {/* Feature Highlights */}
            <div className="flex flex-wrap gap-3 sm:gap-4 lg:gap-6">
              <div className="flex items-center space-x-2">
                <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                <span className="text-white text-xs sm:text-sm font-medium">{t("footer.features.secure")}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                <span className="text-white text-xs sm:text-sm font-medium">{t("footer.features.fast")}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Link2 className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                <span className="text-white text-xs sm:text-sm font-medium">{t("footer.features.multichain")}</span>
              </div>
            </div>
          </div>
          
          {/* Right Section - Navigation Links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {/* Product Column */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-white font-bold !text-base sm:text-lg">{t("footer.sections.resources")}</h3>
              <ul className="space-y-1 sm:space-y-2">
                <li><a href="#" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t("footer.links.assetRegistration")}</a></li>
                <li><a href="#" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t("footer.links.documentation")}</a></li>
                <li><a href="#" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t("footer.links.support")}</a></li>
              </ul>
            </div>
            
            {/* Company Column */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-white font-bold !text-base sm:text-lg">{t("footer.sections.company")}</h3>
              <ul className="space-y-1 sm:space-y-2">
                <li><a href="#" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t("footer.links.aboutUs")}</a></li>
                <li><a href="#" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t("footer.links.careers")}</a></li>
                <li><a href="#" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t("footer.links.blog")}</a></li>
              </ul>
            </div>
            
            {/* Support Column */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-white font-bold !text-base sm:text-lg">{t("footer.sections.support")}</h3>
              <ul className="space-y-1 sm:space-y-2">
                <li><a href="#" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t("footer.links.helpCenter")}</a></li>
                <li><a href="#" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t("footer.links.contactSupport")}</a></li>
                <li><a href="#" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t("footer.links.faq")}</a></li>
              </ul>
            </div>
            
            {/* Legal Column */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-white font-bold !text-base sm:text-lg">{t("footer.sections.legal")}</h3>
              <ul className="space-y-1 sm:space-y-2">
                <li><a href="#" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t("footer.links.privacy")}</a></li>
                <li><a href="#" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t("footer.links.terms")}</a></li>
                <li><a href="#" className="text-white/80 hover:text-white transition-colors text-xs sm:text-sm">{t("footer.links.cookiePolicy")}</a></li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Bottom Section - Social Media & Copyright */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 mb-8 sm:mb-12">
          {/* Legal/Operational Details */}
          <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-white/80">
            <p>{t("footer.legal.headquarters")}</p>
            <p>
              {t("footer.legal.description")}
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
            <p className="text-white/80 text-xs sm:text-sm">{t("footer.copyright")}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
