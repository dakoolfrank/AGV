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

        {/* Official Contract Addresses */}
        <div className="max-w-6xl mx-auto mb-6 sm:mb-8 rounded-2xl border border-white/10 bg-[#1a2a4a]/50 p-4 sm:p-6">
          <h3 className="text-sm sm:text-base font-semibold text-white mb-3">Official Contracts (BSC Mainnet)</h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-white/60">pGVT:</span>
              <a
                href="https://bscscan.com/token/0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs sm:text-sm font-mono text-[#4ade80] hover:underline truncate"
              >
                0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-white/60">sGVT:</span>
              <a
                href="https://bscscan.com/token/0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs sm:text-sm font-mono text-[#4ade80] hover:underline truncate"
              >
                0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3
              </a>
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