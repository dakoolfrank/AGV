'use client';

import { useTranslations } from '@/lib/translation-provider';

export function ClaimFOMOBanner() {
  const { t } = useTranslations('claimFOMOBanner');
  
  return (
    <div className="w-full mb-6 sm:mb-8">
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-orange-500/40 bg-gradient-to-r from-red-500/20 via-orange-500/20 to-red-500/20 backdrop-blur-sm">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-600/30 via-orange-600/30 to-red-600/30 animate-pulse"></div>
        
        {/* Content */}
        <div className="relative px-4 sm:px-6 md:px-8 py-6 sm:py-8 text-center">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <span className="text-2xl sm:text-3xl animate-bounce">🔥</span>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
              {t('title')}
            </h2>
            <span className="text-2xl sm:text-3xl animate-bounce">🔥</span>
          </div>
          <p className="text-sm sm:text-base md:text-lg text-orange-100 font-semibold">
            {t('description')}
          </p>
        </div>
      </div>
    </div>
  );
}

