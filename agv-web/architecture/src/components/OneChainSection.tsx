'use client';

import { SectionWrapper } from '@/components/ui/SectionWrapper';
import { Box } from '@/components/ui/Box';
import { useTranslations } from '@/lib/translation-provider';

export function OneChainSection() {
  const { t } = useTranslations('oneChain');
  const featureLabels = Array.from({ length: 5 }, (_, index) => t(`features.${index}`));

  return (
    <SectionWrapper
      glowEffect={{
        bottom: '77%',
        left: '7%',
        width: '700px',
        height: '700px',
        blur: '100px'
      }}
      scrollAnimation={{ direction: 'bottom', delay: 0 }}
    >
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6 px-2">
          {t('heading.prefix')}{' '}
          <span className="text-blue-400 italic">{t('heading.highlight')}</span>
        </h2>
        
        <p className="text-base sm:text-lg md:text-xl text-white/90 mb-6 sm:mb-8 max-w-3xl mx-auto leading-relaxed px-4">
          {t('description')}
        </p>
        
        <div className="mb-8 sm:mb-12 flex justify-center px-4">
          <img src="/agv_bnb.png" alt={t('imageAlt')} className="max-w-full sm:max-w-2xl w-full h-auto rounded-lg" />
        </div>
        
        <div className="flex flex-col items-center gap-4 sm:gap-6 mb-8 sm:mb-12 max-w-6xl mx-auto">
          {/* Top row - 3 boxes */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 justify-center gap-3 sm:gap-6 w-full">
            <Box className="w-full min-h-[140px] sm:min-h-[200px] flex flex-col justify-center" padding="sm">
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center p-2 sm:p-4 justify-center text-white font-bold text-base sm:text-lg mx-auto mb-2 sm:mb-4 bg-primary">
                <img src="/icons/thunder.svg" alt={featureLabels[0]} className="w-8 h-8 sm:w-12 sm:h-12" />
              </div>
              <h4 className="text-white font-semibold mb-2 text-center text-xs sm:text-base">{featureLabels[0]}</h4>
            </Box>

            <Box className="w-full min-h-[140px] sm:min-h-[200px] flex flex-col justify-center" padding="sm">
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center p-2 sm:p-4 justify-center text-white font-bold text-base sm:text-lg mx-auto mb-2 sm:mb-4 bg-primary">
                <img src="/icons/stamp.svg" alt={featureLabels[1]} className="w-8 h-8 sm:w-12 sm:h-12" />
              </div>
              <h4 className="text-white font-semibold mb-2 text-center text-xs sm:text-base">{featureLabels[1]}</h4>
            </Box>

            <Box className="w-full min-h-[140px] sm:min-h-[200px] flex flex-col justify-center col-span-2 sm:col-span-1 lg:col-span-1" padding="sm">
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center p-2 sm:p-4 justify-center text-white font-bold text-base sm:text-lg mx-auto mb-2 sm:mb-4 bg-primary">
                <img src="/icons/spring.svg" alt={featureLabels[2]} className="w-8 h-8 sm:w-12 sm:h-12" />
              </div>
              <h4 className="text-white font-semibold mb-2 text-center text-xs sm:text-base">{featureLabels[2]}</h4>
            </Box>
          </div>

          {/* Bottom row - 2 boxes centered side by side */}
          <div className="grid grid-cols-2 justify-center gap-3 sm:gap-6 w-full max-w-2xl mx-auto">
            <Box className="w-full min-h-[140px] sm:min-h-[200px] flex flex-col justify-center" padding="sm">
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center p-2 sm:p-4 justify-center text-white font-bold text-base sm:text-lg mx-auto mb-2 sm:mb-4 bg-primary">
                <img src="/icons/checked.svg" alt={featureLabels[3]} className="w-8 h-8 sm:w-12 sm:h-12" />
              </div>
              <h4 className="text-white font-semibold mb-2 text-center text-xs sm:text-base">{featureLabels[3]}</h4>
            </Box>

            <Box className="w-full min-h-[140px] sm:min-h-[200px] flex flex-col justify-center" padding="sm">
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center p-2 sm:p-4 justify-center text-white font-bold text-base sm:text-lg mx-auto mb-2 sm:mb-4 bg-primary">
                <img src="/icons/brick.svg" alt={featureLabels[4]} className="w-8 h-8 sm:w-12 sm:h-12" />
              </div>
              <h4 className="text-white font-semibold mb-2 text-center text-xs sm:text-base">{featureLabels[4]}</h4>
            </Box>
          </div>
        </div>
        
        <div className="w-full max-w-4xl mx-auto border-t border-white"></div>
      </div>
    </SectionWrapper>
  );
}

