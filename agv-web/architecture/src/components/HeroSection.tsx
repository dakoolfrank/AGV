'use client';

import { ScrollAnimation } from '@/components/ScrollAnimation';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useTranslations } from '@/lib/translation-provider';

export function HeroSection() {
  const { t } = useTranslations('hero');

  return (
    <section className="relative py-12 sm:py-16 md:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden min-h-[85vh] sm:min-h-[90vh] flex items-center bg-black">
      <div className="relative z-10 max-w-7xl mx-auto w-full">
        {/* Main Hero Content - Center Aligned */}
        <ScrollAnimation direction="bottom" delay={0}>
          <div className="text-center mb-12 max-w-5xl mx-auto">
            {/* Heading */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              {t('title.main')}
              <br />
              <span>
                {t('title.highlight')}
              </span>
            </h1>
            
            {/* Description */}
            <p className="text-base sm:text-lg md:text-xl text-white/80 mb-8 leading-relaxed max-w-3xl mx-auto">
              {t('description')}
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
              <PrimaryButton href="#token-architecture" className="text-sm sm:text-base md:text-lg px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
                {t('primaryCta')}
              </PrimaryButton>
              <a 
                href={t('tokenomicsHref')}
                className="text-sm sm:text-base md:text-lg px-6 sm:px-8 py-3 sm:py-4 border-2 border-white text-white hover:bg-white/10 transition-colors rounded-lg w-full sm:w-auto text-center"
              >
                {t('secondaryCta')}
              </a>
            </div>
            
            {/* Token Icons with Animated Arrow */}
            <div className="mb-6 sm:mb-8 flex items-center justify-center gap-4 sm:gap-6 md:gap-8 px-2">
              {/* PreGVT Icon */}
              <div className="shrink-0">
                <img src="/pregvt_icon.png" alt={t('icons.pregvtAlt')} className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32" />
              </div>
              
              {/* Animated Moving Lines */}
              <div className="relative flex items-center justify-center w-16 sm:w-24 md:w-32 h-12 sm:h-16 md:h-20 overflow-hidden">
                {/* Multiple animated lines moving from left to right */}
                <div className="absolute top-[20%] left-0 w-full h-0.5 sm:h-1 bg-white/40 -translate-y-1/2 overflow-hidden">
                  <div className="absolute left-0 top-0 w-8 sm:w-12 md:w-16 h-full bg-white animate-move-arrow" style={{ animationDelay: '0s' }}></div>
                </div>
                <div className="absolute top-[35%] left-0 w-full h-0.5 sm:h-1 bg-white/40 -translate-y-1/2 overflow-hidden">
                  <div className="absolute left-0 top-0 w-6 sm:w-10 md:w-12 h-full bg-white animate-move-arrow" style={{ animationDelay: '0.4s' }}></div>
                </div>
                <div className="absolute top-[50%] left-0 w-full h-0.5 sm:h-1 bg-white/40 -translate-y-1/2 overflow-hidden">
                  <div className="absolute left-0 top-0 w-10 sm:w-14 md:w-20 h-full bg-white animate-move-arrow" style={{ animationDelay: '0.8s' }}></div>
                </div>
                <div className="absolute top-[65%] left-0 w-full h-0.5 sm:h-1 bg-white/40 -translate-y-1/2 overflow-hidden">
                  <div className="absolute left-0 top-0 w-7 sm:w-11 md:w-14 h-full bg-white animate-move-arrow" style={{ animationDelay: '1.2s' }}></div>
                </div>
                <div className="absolute top-[80%] left-0 w-full h-0.5 sm:h-1 bg-white/40 -translate-y-1/2 overflow-hidden">
                  <div className="absolute left-0 top-0 w-9 sm:w-13 md:w-18 h-full bg-white animate-move-arrow" style={{ animationDelay: '1.6s' }}></div>
                </div>
              </div>
              
              {/* GVT Icon */}
              <div className="shrink-0">
                <img src="/gvt_icon.png" alt={t('icons.gvtAlt')} className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32" />
              </div>
            </div>
            
            {/* White Horizontal Line */}
            <div className="w-full max-w-4xl mx-auto border-t border-white"></div>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
