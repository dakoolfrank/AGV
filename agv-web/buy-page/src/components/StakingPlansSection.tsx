'use client';

import { ScrollAnimation } from '@/components/ScrollAnimation';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Rocket } from 'lucide-react';
import { useTranslations } from '@/lib/translation-provider';

export function StakingPlansSection() {
  const { t } = useTranslations('stakingPlans');
  const stakingPlans = [
    {
      type: t('plans.standard.type'),
      lockPeriod: t('plans.standard.lockPeriod'),
      apy: '350 %',
      returnMode: t('plans.standard.returnMode'),
      rewards: t('plans.standard.rewards'),
      perks: []
    },
    {
      type: t('plans.threeMonth.type'),
      lockPeriod: t('plans.threeMonth.lockPeriod'),
      apy: '400 %',
      returnMode: t('plans.threeMonth.returnMode'),
      rewards: t('plans.threeMonth.rewards'),
      perks: []
    },
    {
      type: t('plans.sixMonth.type'),
      lockPeriod: t('plans.sixMonth.lockPeriod'),
      apy: '480 %',
      returnMode: t('plans.sixMonth.returnMode'),
      rewards: t('plans.sixMonth.rewards'),
      perks: []
    },
    {
      type: t('plans.twelveMonth.type'),
      lockPeriod: t('plans.twelveMonth.lockPeriod'),
      apy: '490 %',
      returnMode: t('plans.twelveMonth.returnMode'),
      rewards: t('plans.twelveMonth.rewards'),
      perks: [t('plans.twelveMonth.perks')]
    }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, rgba(34, 50, 86, 0.5), rgba(34, 50, 86, 0.85))' }}>
      <div className="max-w-7xl mx-auto relative z-10">
        <ScrollAnimation direction="bottom" delay={0}>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center mb-4">
            {t('title')}
          </h2>
          <p className="text-center text-white/70 mb-12">
            {t('subtitle')}
          </p>
        </ScrollAnimation>

        <ScrollAnimation direction="bottom" delay={200}>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-8 border border-white/20 overflow-x-auto">
            <div className="min-w-full">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-4 px-4 text-white font-bold">{t('table.type')}</th>
                    <th className="text-left py-4 px-4 text-white font-bold">{t('table.lockPeriod')}</th>
                    <th className="text-left py-4 px-4 text-white font-bold">{t('table.apyReturnMode')}</th>
                    <th className="text-left py-4 px-4 text-white font-bold">{t('table.rewardsPerks')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stakingPlans.map((plan, index) => (
                    <tr 
                      key={index} 
                      className="border-b border-white/10 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-4 px-4 font-semibold" style={{ color: '#4FACFE' }}>{plan.type}</td>
                      <td className="py-4 px-4 text-white">{plan.lockPeriod}</td>
                      <td className="py-4 px-4">
                        <span className="font-bold" style={{ color: '#4FACFE' }}>{plan.apy}</span>
                        <span className="text-white/70 text-sm ml-2">{plan.returnMode}</span>
                      </td>
                      <td className="py-4 px-4 text-white/70">
                        <div>{plan.rewards}</div>
                        {plan.perks.length > 0 && (
                          <div className="text-xs mt-1" style={{ color: '#4FACFE' }}>
                            {plan.perks.join(', ')}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollAnimation>

        {/* Small Print */}
        <ScrollAnimation direction="bottom" delay={400}>
          <div className="mt-8 text-center">
            <p className="text-white/60 text-sm">
              {t('smallPrint')}
            </p>
          </div>
        </ScrollAnimation>

        {/* CTA Button */}
        <ScrollAnimation direction="bottom" delay={600}>
          <div className="mt-12 text-center">
            <PrimaryButton href="/buy" className="text-lg px-8 py-4 flex items-center justify-center gap-2">
              <Rocket className="w-5 h-5 inline" /> {t('cta')}
            </PrimaryButton>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}

