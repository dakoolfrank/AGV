'use client';

import { SectionWrapper } from '@/components/ui/SectionWrapper';
import { useTranslations } from '@/lib/translation-provider';

export function SecuritySection() {
  const { t } = useTranslations('security');
  const points = Array.from({ length: 6 }, (_, index) => t(`points.${index}`));

  return (
    <SectionWrapper
      glowEffect={{
        top: '50%',
        left: '50%',
        width: '800px',
        height: '800px',
        blur: '100px',
        transform: 'translate(-50%, -50%)'
      }}
      scrollAnimation={{ direction: 'bottom', delay: 0 }}
    >
      <div className="text-center mb-8 sm:mb-12">
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 sm:mb-8 px-4">
          {t('heading.prefix')}{' '}
          <span className="text-blue-400 italic">{t('heading.highlight')}</span>
        </h2>
      </div>

      {/* Mobile: Bullet List */}
      <div className="md:hidden max-w-2xl mx-auto mb-8 px-4">
        <ul className="space-y-3 text-left">
          {points.map(point => (
            <li key={point} className="text-white text-base font-bold flex items-start">
              <span className="text-blue-400 mr-3 shrink-0">•</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Desktop: Image with connecting lines */}
      <div className="hidden md:block relative max-w-5xl mx-auto mb-8 sm:mb-12 px-4" style={{ minHeight: '400px' }}>
        {/* Central Image (inverted pentagon shape - placeholder) */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[400px] h-[400px] lg:w-[500px] lg:h-[500px]">
            <img src="/shield.png" alt="Security Core" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Text positions around the image with connecting lines */}
        {/* Top Left - text1 */}
        <div className="absolute top-16 left-0 max-w-[220px]">
          <div className="relative">
            <p className="text-white text-sm md:text-base font-bold text-right mb-2">{points[0]}</p>
          </div>
        </div>

        {/* Top Right - text2 */}
        <div className="absolute top-16 right-0 max-w-[220px]">
          <div className="relative">
            <p className="text-white text-sm md:text-base font-bold text-left mb-2">
              {points[1]}</p>
          </div>
        </div>

        {/* Bottom Left - text3 */}
        <div className="absolute bottom-32 left-0 max-w-[220px]">
          <div className="relative">
            <p className="text-white text-sm md:text-base font-bold text-right mt-2">
              {points[2]}
            </p>
          </div>
        </div>

        {/* Bottom Right - text4 */}
        <div className="absolute bottom-32 right-0 max-w-[220px]">
          <div className="relative">
            <p className="text-white text-sm md:text-base font-bold text-left mt-2">{points[3]}</p>
          </div>
        </div>

        {/* Bottom Center Left - text5 */}
        <div className="absolute bottom-[-90px] left-1/3 max-w-[200px] transform -translate-x-1/2">
          <div className="relative">
            <p className="text-white text-sm md:text-base font-bold text-right mt-2">{points[4]}</p>
          </div>
        </div>

        {/* Bottom Center Right - text6 */}
        <div className="absolute bottom-[-90px] right-1/3 max-w-[200px] transform translate-x-1/2">
          <div className="relative">
            <p className="text-white text-sm md:text-base font-bold text-left mt-2">{points[5]}</p>
          </div>
        </div>
      </div>
          
      <div className="w-full max-w-4xl mx-auto border-t border-white mt-[10pc]"></div>
    </SectionWrapper>
  );
}

