'use client';

import { ScrollAnimation } from '@/components/ScrollAnimation';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Play } from 'lucide-react';
import { useTranslations } from '@/lib/translation-provider';

export function RealAssetSection() {
  const { t } = useTranslations('realAsset');
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-black">
      {/* Glow Effect */}
      <div 
        className="absolute pointer-events-none" 
        style={{ 
          bottom: '10%',
          left: '8%',
          width: '700px',
          height: '700px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(37,99,235,0.5) 20%, rgba(29,78,216,0.4) 40%, transparent 70%)',
          transform: 'translate(-50%, 50%)',
          zIndex: 0,
          filter: 'blur(100px)',
          opacity: 0.9
        }}>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <ScrollAnimation direction="bottom" delay={0}>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center mb-12">
            {t('title')}{' '}
            <span className="text-blue-400 italic">{t('onChain')}</span>
          </h2>
        </ScrollAnimation>

        <div className="space-y-8">
          {/* Image Container */}
          <ScrollAnimation direction="bottom" delay={200}>
            <div className="relative rounded-2xl overflow-hidden border-2 border-teal-400/30 shadow-2xl max-w-4xl mx-auto">
              <img src="/depin.jpg" alt="Depin Video" width={500} height={500} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <p className="text-white text-sm sm:text-base flex items-center gap-2">{t('liveFeed')}</p>
              </div>
            </div>
          </ScrollAnimation>

          {/* Data Flow Architecture - Cards under image */}
          <ScrollAnimation direction="bottom" delay={400}>
            <div className="max-w-6xl mx-auto">
              <h3 className="text-2xl font-bold text-white mb-6 text-center">{t('dataFlowArchitecture')}</h3>
              
              {/* First Row: 3 Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 justify-items-center">
                {/* Step 1 */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 w-full max-w-sm animate-fade-in-up">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-4" style={{ backgroundColor: '#4FACFE' }}>
                    1
                  </div>
                  <h4 className="text-white font-semibold mb-2 text-center">{t('steps.solarPower.title')}</h4>
                  <p className="text-sm text-center" style={{ color: '#4FACFE' }}>{t('steps.solarPower.description')}</p>
                </div>

                {/* Step 2 */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 w-full max-w-sm animate-fade-in-up-delay">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-4" style={{ backgroundColor: '#4FACFE' }}>
                    2
                  </div>
                  <h4 className="text-white font-semibold mb-2 text-center">{t('steps.energyNode.title')}</h4>
                  <p className="text-sm text-center" style={{ color: '#4FACFE' }}>{t('steps.energyNode.description')}</p>
                </div>

                {/* Step 3 */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 w-full max-w-sm animate-fade-in-up-delay">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-4" style={{ backgroundColor: '#4FACFE' }}>
                    3
                  </div>
                  <h4 className="text-white font-semibold mb-2 text-center">{t('steps.depinNetwork.title')}</h4>
                  <p className="text-sm text-center" style={{ color: '#4FACFE' }}>{t('steps.depinNetwork.description')}</p>
                </div>
              </div>

              {/* Second Row: 2 Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 justify-items-center max-w-2xl mx-auto">
                {/* Step 4 */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 w-full max-w-sm animate-fade-in-up-delay">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-4" style={{ backgroundColor: '#4FACFE' }}>
                    4
                  </div>
                  <h4 className="text-white font-semibold mb-2 text-center">{t('steps.aiCompute.title')}</h4>
                  <p className="text-sm text-center" style={{ color: '#4FACFE' }}>{t('steps.aiCompute.description')}</p>
                </div>

                {/* Step 5 */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 w-full max-w-sm animate-fade-in-up-delay">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-4" style={{ backgroundColor: '#4FACFE' }}>
                    5
                  </div>
                  <h4 className="text-white font-semibold mb-2 text-center">{t('steps.tokenYield.title')}</h4>
                  <p className="text-sm text-center" style={{ color: '#4FACFE' }}>{t('steps.tokenYield.description')}</p>
                </div>
              </div>

              {/* CTA Button */}
              <div className="mt-8 flex justify-center">
                <PrimaryButton 
                  href="https://investor.agvprotocol.org/en/depin" 
                  external
                  className="flex items-center justify-center gap-2"
                >
                  Watch DePIN On-Chain Proof <Play className="w-4 h-4 inline" />
                </PrimaryButton>
              </div>
            </div>
          </ScrollAnimation>
        </div>
      </div>
    </section>
  );
}

