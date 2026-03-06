'use client';

import { ScrollAnimation } from '@/components/ScrollAnimation';
import { Globe, Puzzle, Trophy } from 'lucide-react';
import { useTranslations } from '@/lib/translation-provider';

export function CommunitySection() {
  const { t } = useTranslations('community');
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-black">
      {/* Glow Effect */}
      <div 
        className="absolute pointer-events-none" 
        style={{ 
          bottom: '15%',
          right: '10%',
          width: '680px',
          height: '680px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(37,99,235,0.5) 20%, rgba(29,78,216,0.4) 40%, transparent 70%)',
          transform: 'translate(50%, 50%)',
          zIndex: 0,
          filter: 'blur(95px)',
          opacity: 0.9
        }}>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <ScrollAnimation direction="bottom" delay={0}>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center mb-12">
            {t('title')}
          </h2>
        </ScrollAnimation>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <ScrollAnimation direction="bottom" delay={200}>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 text-center">
              <Globe className="w-12 h-12 mx-auto mb-4" style={{ color: '#4FACFE' }} />
              <h3 className="text-2xl font-bold text-white mb-4">{t('activeWallets')}</h3>
              <p className="text-white/70">{t('fromCountries')}</p>
            </div>
          </ScrollAnimation>

          <ScrollAnimation direction="bottom" delay={400}>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 text-center">
              <Puzzle className="w-12 h-12 mx-auto mb-4" style={{ color: '#4FACFE' }} />
              <h3 className="text-2xl font-bold text-white mb-4">{t('missions')}</h3>
              <p className="text-white/70">{t('missionsDesc')}</p>
            </div>
          </ScrollAnimation>

          <ScrollAnimation direction="bottom" delay={600}>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 text-center">
              <Trophy className="w-12 h-12 mx-auto mb-4" style={{ color: '#4FACFE' }} />
              <h3 className="text-2xl font-bold text-white mb-4">{t('topReferrers')}</h3>
              <p className="text-white/70">{t('topReferrersDesc')}</p>
            </div>
          </ScrollAnimation>
        </div>
      </div>
    </section>
  );
}

