'use client';

import { ScrollAnimation } from '@/components/ScrollAnimation';
import { SectionWrapper } from '@/components/ui/SectionWrapper';
import { Box } from '@/components/ui/Box';
import { Coins, Lock, Calendar, LockOpen, Wallet, ArrowRight, ArrowDown } from 'lucide-react';
import { useTranslations } from '@/lib/translation-provider';

export function VestingSection() {
  const { t } = useTranslations('vesting');
  const stepIcons = [Coins, Lock, Calendar, LockOpen, Wallet];
  const stepTexts = Array.from({ length: 5 }, (_, index) => t(`steps.${index}`));
  const steps = stepIcons.map((icon, index) => ({ icon, text: stepTexts[index] }));

  return (
    <SectionWrapper
      glowEffect={{
        bottom: '15%',
        right: '10%',
        width: '700px',
        height: '700px',
        blur: '100px',
        transform: 'translate(50%, 50%)'
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
        <Box padding="md" className="hidden sm:block">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-2 md:gap-4">
                {steps.map((step, index) => {
                  const IconComponent = step.icon;
                  return (
                    <div key={index} className="flex flex-col sm:flex-row items-center">
                      <ScrollAnimation direction="bottom" delay={index * 100}>
                        <div className="flex flex-col items-center text-center">
                          {/* Icon in circular border */}
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-[3px] sm:border-4 border-primary flex items-center justify-center mb-3 sm:mb-4 bg-white/10 backdrop-blur-sm">
                            <IconComponent className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                          </div>
                          {/* Text */}
                          <p className="text-white text-xs sm:text-sm font-bold max-w-[120px] sm:max-w-none">{step.text}</p>
                        </div>
                      </ScrollAnimation>
                      {/* Arrow between groups (not after last one) */}
                      {index < steps.length - 1 && (
                        <div className="hidden sm:flex items-center justify-center mx-2 sm:mx-3 md:mx-4">
                          <ArrowRight className="w-6 h-6 sm:w-8 sm:h-8 text-white/60" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
        </Box>
        <div className="sm:hidden">
          <div className="flex flex-col items-center gap-4">
            {steps.map((step, index) => {
              const IconComponent = step.icon;
              return (
                <div key={index} className="flex flex-col items-center w-full">
                  <ScrollAnimation direction="bottom" delay={index * 100}>
                    <div className="flex flex-col items-center text-center w-full">
                      {/* Icon in circular border */}
                      <div className="w-14 h-14 rounded-full border-[3px] border-primary flex items-center justify-center mb-2 bg-white/10 backdrop-blur-sm">
                        <IconComponent className="w-7 h-7 text-white" />
                      </div>
                      {/* Text */}
                      <p className="text-white text-xs font-bold px-2 whitespace-pre-line">{step.text}</p>
                    </div>
                  </ScrollAnimation>
                  {/* Downward arrow between steps (not after last one) */}
                  {index < steps.length - 1 && (
                    <div className="flex items-center justify-center my-2">
                      <ArrowDown className="w-5 h-5 text-white/60" strokeWidth={3} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      <div className="w-full max-w-4xl mx-auto border-t border-white"></div>
    </SectionWrapper>
  );
}

