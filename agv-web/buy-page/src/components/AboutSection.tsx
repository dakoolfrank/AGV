'use client';

import { ScrollAnimation } from '@/components/ScrollAnimation';
import Image from 'next/image';
import { useTranslations } from '@/lib/translation-provider';

export function AboutSection() {
  const { t } = useTranslations('about');
  
  const steps = [
    {
      title: t('steps.step1.title'),
      description: t('steps.step1.description'),
      icon: '/icons/create-account.svg'
    },
    {
      title: t('steps.step2.title'),
      description: t('steps.step2.description'),
      icon: '/icons/deposit.svg'
    },
    {
      title: t('steps.step3.title'),
      description: t('steps.step3.description'),
      icon: '/icons/participate.svg'
    },
    {
      title: t('steps.step4.title'),
      description: t('steps.step4.description'),
      icon: '/icons/private.svg'
    }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black relative overflow-hidden">
      {/* Glow Effect */}
      <div 
        className="absolute pointer-events-none" 
        style={{ 
          top: '20%',
          left: '10%',
          width: '680px',
          height: '680px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(37,99,235,0.5) 20%, rgba(29,78,216,0.4) 40%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
          filter: 'blur(95px)',
          opacity: 0.9
        }}>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <ScrollAnimation direction="bottom" delay={0}>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-pulse-slow">
              {t('valueTitle')} <span className="text-blue-400 italic">{t('valueTitleHighlight')}</span>
            </h2>
            <div className="max-w-4xl mx-auto">
              <p className="text-lg text-white mb-8 leading-relaxed">
                {t('valueDescription')}
              </p>
            </div>
          </div>
        </ScrollAnimation>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-12 auto-rows-fr">
          {steps.map((step, index) => (
            <ScrollAnimation key={index} direction="scale" delay={index * 200}>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 text-center hover:bg-white/15 transition-all duration-300 h-full flex flex-col">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shrink-0">
                  <Image
                    src={step.icon}
                    alt={step.title}
                    width={40}
                    height={40}
                    className="object-contain"
                  />
                </div>
                <h4 className="text-lg font-bold text-white mb-3 shrink-0">{step.title}</h4>
                <p className="text-white text-sm leading-relaxed grow">{step.description}</p>
              </div>
            </ScrollAnimation>
          ))}
        </div>

        {/* Value Propositions */}
        <ScrollAnimation direction="bottom" delay={1000}>
          <div className="mt-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-pulse-slow">
                {t('newEraTitle')} <span className="text-blue-400 italic">{t('newEraTitleHighlight')}</span>
              </h2>
              <p className="text-lg text-white max-w-4xl mx-auto leading-relaxed">
                {t('newEraDescription')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 auto-rows-fr">
              <ScrollAnimation direction="bottom" delay={1200}>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 text-center hover:bg-white/15 transition-all duration-300 h-full flex flex-col">
                  <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">{t('features.realAssetAnchoring.title')}</h3>
                  <p className="text-white leading-relaxed">
                    {t('features.realAssetAnchoring.description')}
                  </p>
                </div>
              </ScrollAnimation>

              <ScrollAnimation direction="bottom" delay={1400}>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 text-center hover:bg-white/15 transition-all duration-300 h-full flex flex-col">
                  <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">{t('features.strongCreditBacking.title')}</h3>
                  <p className="text-white leading-relaxed">
                    {t('features.strongCreditBacking.description')}
                  </p>
                </div>
              </ScrollAnimation>

              <ScrollAnimation direction="bottom" delay={1600}>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 text-center hover:bg-white/15 transition-all duration-300 h-full flex flex-col">
                  <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">{t('features.compliantInnovative.title')}</h3>
                  <p className="text-white leading-relaxed">
                    {t('features.compliantInnovative.description')}
                  </p>
                </div>
              </ScrollAnimation>
            </div>
          </div>
        </ScrollAnimation>
        <ScrollAnimation direction="bottom" delay={800}>
          <div className="text-center">
            <button className="bg-primary text-white px-8 py-4 mt-8 rounded-xl text-lg font-bold transition-all duration-300 transform hover:scale-105 animate-bounce-gentle">
              {t('buyNow')}
            </button>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
