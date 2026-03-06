'use client';

import { ScrollAnimation } from '@/components/ScrollAnimation';
import { SectionWrapper } from '@/components/ui/SectionWrapper';
import { Box } from '@/components/ui/Box';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from '@/lib/translation-provider';

export function TwoTokenArchitectureSection() {
  const { t } = useTranslations('twoToken');
  const pregvtBullets = Array.from({ length: 4 }, (_, index) => t(`pregvt.bullets.${index}`));
  const gvtBullets = Array.from({ length: 3 }, (_, index) => t(`gvt.bullets.${index}`));
  return (
    <SectionWrapper
      glowEffect={{
        top: '30%',
        right: '15%',
        width: '650px',
        height: '650px',
        blur: '90px'
      }}
      scrollAnimation={{ direction: 'bottom', delay: 0 }}
    >
      <div className="text-center mb-8 sm:mb-12">
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 sm:mb-8 px-4">
          {t('heading.prefix')}{' '}
          <span className="text-blue-400 italic">{t('heading.highlight')}</span>
        </h2>
      </div>

      <ScrollAnimation direction="left" delay={200}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch mb-12 sm:mb-16">
          <Box className="relative flex flex-col">
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">
              <span className="text-blue-400">{t('pregvt.title')}</span>: {t('pregvt.subtitle')}
            </h3>
            <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6 grow">
              {pregvtBullets.map((bullet) => (
                <li key={bullet} className="text-white/90 flex items-start text-base sm:text-lg md:text-xl mb-3 sm:mb-4 md:mb-6">
                  <span className="text-blue-400 mr-2 shrink-0">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            
            <div className="bg-yellow-500/20 backdrop-blur-sm rounded-lg p-3 sm:p-4 border-2 border-yellow-500 flex items-center gap-2 sm:gap-3 w-fit">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 shrink-0" />
              <span className="text-white font-semibold text-sm sm:text-base">{t('pregvt.callout')}</span>
            </div>
          </Box>
          
          <div className="flex justify-center lg:justify-end items-stretch px-4 lg:px-0">
            <img src="/pregvt.png" alt={t('pregvt.imageAlt')} className="max-w-full sm:max-w-md w-full h-auto object-contain rounded-lg animate-pulse" />
          </div>
        </div>
      </ScrollAnimation>

      <ScrollAnimation direction="right" delay={400}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch mb-12 sm:mb-16">
          <div className="flex justify-center lg:justify-start order-2 lg:order-1 items-stretch px-4 lg:px-0">
            <img src="/gvt.png" alt={t('gvt.imageAlt')} className="max-w-full sm:max-w-md w-full h-auto object-contain rounded-lg animate-pulse" />
          </div>
          
          <Box className="relative order-1 lg:order-2 flex flex-col">
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">
              <span className="text-blue-400">{t('gvt.title')}</span>: {t('gvt.subtitle')}
            </h3>
            <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6 grow">
              {gvtBullets.map((bullet) => (
                <li key={bullet} className="text-white/90 flex items-start text-base sm:text-lg md:text-xl mb-3 sm:mb-4 md:mb-6">
                  <span className="text-blue-400 mr-2 shrink-0">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            
            <div className="bg-green-500/20 backdrop-blur-sm rounded-lg p-3 sm:p-4 border-2 border-green-500 flex items-center gap-2 sm:gap-3 w-fit">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-green-400 shrink-0" />
              <span className="text-white font-semibold text-sm sm:text-base">{t('gvt.callout')}</span>
            </div>
          </Box>
        </div>
      </ScrollAnimation>
          
      <div className="w-full max-w-4xl mx-auto border-t border-white"></div>
    </SectionWrapper>
  );
}

