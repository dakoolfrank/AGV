'use client';

import { ScrollAnimation } from '@/components/ScrollAnimation';
import { SectionWrapper } from '@/components/ui/SectionWrapper';
import { Box } from '@/components/ui/Box';
import { Clock, Shield, Eye, TrendingUp, Building, FileText, Network } from 'lucide-react';
import { useTranslations } from '@/lib/translation-provider';

export function BuiltForNextSection() {
  const { t } = useTranslations('builtForNext');
  const iconComponents = [Clock, Shield, Eye, TrendingUp, Building, FileText, Network];
  const labels = Array.from({ length: iconComponents.length }, (_, index) => t(`items.${index}`));
  const items = iconComponents.map((icon, index) => ({ icon, text: labels[index] }));

  return (
    <SectionWrapper
      glowEffect={{
        top: '25%',
        right: '12%',
        width: '650px',
        height: '650px',
        blur: '90px',
        transform: 'translate(50%, -50%)'
      }}
      scrollAnimation={{ direction: 'bottom', delay: 0 }}
    >
      <div className="text-center mb-8 sm:mb-12">
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6 px-4">
          {t('heading.prefix')}{' '}
          <span className="text-blue-400 italic">{t('heading.highlight')}</span>
        </h2>
        
        <p className="text-base sm:text-lg md:text-xl text-white/90 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed px-4">
          {t('description')}
        </p>
      </div>

      <div className="max-w-6xl mx-auto mb-8 sm:mb-12 px-4">
        <Box className="hidden sm:block">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 justify-center gap-4 sm:gap-6 mb-4 sm:mb-6">
            {items.slice(0, 4).map((item, index) => {
              const IconComponent = item.icon;
              return (
                <ScrollAnimation key={index} direction="bottom" delay={index * 100}>
                  <Box className="flex flex-col items-center justify-center text-center w-full sm:w-40 md:w-48 h-40 sm:h-44 md:h-48" padding="md" rounded="xl">
                    {/* Icon in circular blue bg */}
                    <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-blue-500 flex items-center justify-center mb-2 sm:mb-3">
                      <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" />
                    </div>
                    {/* Text */}
                    <p className="text-white text-sm sm:text-base font-medium">{item.text}</p>
                  </Box>
                </ScrollAnimation>
              );
            })}
          </div>

          <div className="flex justify-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-3xl">
              {items.slice(4, 7).map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <ScrollAnimation key={index + 4} direction="bottom" delay={(index + 4) * 100}>
                    <Box className="flex flex-col items-center justify-center text-center w-full sm:w-40 md:w-48 h-40 sm:h-44 md:h-48 mx-auto sm:mx-0" padding="md" rounded="xl">
                      {/* Icon in circular blue bg */}
                      <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-blue-500 flex items-center justify-center mb-2 sm:mb-3">
                        <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" />
                      </div>
                      {/* Text */}
                      <p className="text-white text-sm sm:text-base font-medium">{item.text}</p>
                    </Box>
                  </ScrollAnimation>
                );
              })}
            </div>
          </div>
        </Box>
        <div className="sm:hidden">
          <div className="grid grid-cols-2 gap-3 mb-4">
            {items.slice(0, 2).map((item, index) => {
              const IconComponent = item.icon;
              return (
                <ScrollAnimation key={index} direction="bottom" delay={index * 100}>
                  <Box className="flex flex-col items-center justify-center text-center w-full h-32" padding="sm" rounded="xl">
                    {/* Icon in circular blue bg */}
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center mb-2">
                      <IconComponent className="w-5 h-5 text-white" />
                    </div>
                    {/* Text */}
                    <p className="text-white text-xs font-medium">{item.text}</p>
                  </Box>
                </ScrollAnimation>
              );
            })}
            {/* Third box spanning both columns */}
            {items.slice(2, 3).map((item, index) => {
              const IconComponent = item.icon;
              return (
                <ScrollAnimation key={index + 2} direction="bottom" delay={(index + 2) * 100}>
                  <Box className="flex flex-col items-center justify-center text-center w-full h-32 col-span-2 sm:col-span-1" padding="sm" rounded="xl">
                    {/* Icon in circular blue bg */}
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center mb-2">
                      <IconComponent className="w-5 h-5 text-white" />
                    </div>
                    {/* Text */}
                    <p className="text-white text-xs font-medium">{item.text}</p>
                  </Box>
                </ScrollAnimation>
              );
            })}
            {/* Fourth box spanning both columns */}
            {items.slice(3, 4).map((item, index) => {
              const IconComponent = item.icon;
              return (
                <ScrollAnimation key={index + 3} direction="bottom" delay={(index + 3) * 100}>
                  <Box className="flex flex-col items-center justify-center text-center w-full h-32 col-span-2 sm:col-span-1" padding="sm" rounded="xl">
                    {/* Icon in circular blue bg */}
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center mb-2">
                      <IconComponent className="w-5 h-5 text-white" />
                    </div>
                    {/* Text */}
                    <p className="text-white text-xs font-medium">{item.text}</p>
                  </Box>
                </ScrollAnimation>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {items.slice(4, 6).map((item, index) => {
              const IconComponent = item.icon;
              return (
                <ScrollAnimation key={index + 4} direction="bottom" delay={(index + 4) * 100}>
                  <Box className="flex flex-col items-center justify-center text-center w-full h-32" padding="sm" rounded="xl">
                    {/* Icon in circular blue bg */}
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center mb-2">
                      <IconComponent className="w-5 h-5 text-white" />
                    </div>
                    {/* Text */}
                    <p className="text-white text-xs font-medium">{item.text}</p>
                  </Box>
                </ScrollAnimation>
              );
            })}
            {/* Last box spanning both columns and centered */}
            {items.slice(6, 7).map((item, index) => {
              const IconComponent = item.icon;
              return (
                <ScrollAnimation key={index + 6} direction="bottom" delay={(index + 6) * 100}>
                  <div className="col-span-2 flex justify-center">
                    <Box className="flex flex-col items-center justify-center text-center w-full max-w-[160px] h-32" padding="sm" rounded="xl">
                      {/* Icon in circular blue bg */}
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center mb-2">
                        <IconComponent className="w-5 h-5 text-white" />
                      </div>
                      {/* Text */}
                      <p className="text-white text-xs font-medium">{item.text}</p>
                    </Box>
                  </div>
                </ScrollAnimation>
              );
            })}
          </div>
        </div>
      </div>
          
      <div className="w-full max-w-4xl mx-auto border-t border-white"></div>
    </SectionWrapper>
  );
}

