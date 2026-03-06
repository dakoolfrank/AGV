"use client";

import { Suspense } from "react";
import ModernMintingInterface from "@/components/minting/modern-minting-interface";
import { Footer } from "@/components/layout/footer";
import { useTranslations } from "@/hooks/useTranslations";
import { LanguageSwitcher } from "@/components/ui/language-switcher";

function MintingInterfaceWrapper() {
  return <ModernMintingInterface />;
}

export default function MintPage() {
  const { t } = useTranslations();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#223256] via-[#223256] to-[#223256]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl border p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 shadow-lg max-w-6xl mx-auto bg-[#223256] border-white/10">
          {/* Language Switcher */}
          <div className="flex justify-end mb-4">
            <LanguageSwitcher className="bg-white/10 border-white/20 text-white hover:bg-white/20" />
          </div>
          <div className="text-center space-y-4 sm:space-y-6">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
              {t('minting.title')}
            </h1>
            <div className="space-y-2 text-white">
              <p className="text-sm sm:text-base lg:text-lg">
                {t('minting.description')}
              </p>
              <p className="text-sm sm:text-base lg:text-lg">
                {t('minting.collections')}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 lg:gap-6">
              <div className="flex items-center gap-2 px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 rounded-lg bg-[#4ade80] border border-[#4ade80]">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="text-white font-medium text-sm sm:text-base">{t('minting.liveMinting')}</span>
              </div>
              <div className="flex items-center gap-2 px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 rounded-lg bg-[#4ade80] border border-[#4ade80]">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="text-white font-medium text-sm sm:text-base">{t('minting.multiChain')}</span>
              </div>
              <div className="flex items-center gap-2 px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 rounded-lg bg-[#4ade80] border border-[#4ade80]">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="text-white font-medium text-sm sm:text-base">{t('minting.usdtPayment')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Minting Interface */}
        <div>
          <Suspense fallback={<div className="text-white text-center py-6 sm:py-8 text-sm sm:text-base">Loading minting interface...</div>}>
            <MintingInterfaceWrapper />
          </Suspense>
        </div>
      </div>
      
      {/* Footer */}
      <Footer backgroundClass="bg-gradient-to-br from-[#223256] via-[#1a2a4a] to-[#223256]" textColorClass="text-white" />
    </div>
  );
}