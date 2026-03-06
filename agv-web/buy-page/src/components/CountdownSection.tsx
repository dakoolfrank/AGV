'use client';

import { ScrollAnimation } from '@/components/ScrollAnimation';
import { CountdownDisplay } from '@/components/ui/CountdownDisplay';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useCountdown } from '@/hooks/useCountdown';
import { usePresaleContract } from '@/hooks/usePresaleContract';
import { useTranslations } from '@/lib/translation-provider';

export function CountdownSection() {
  const { t } = useTranslations('countdown');
  const timeLeft = useCountdown();
  const { 
    presaleSold, 
    presaleSupplyCap
  } = usePresaleContract();

  // Calculate data from contract or use defaults
  const maxSupply = presaleSupplyCap ? Number(presaleSupplyCap) / 1e18 : 70000000;
  const totalSupply = presaleSold ? Number(presaleSold) / 1e18 : 69842000;
  const progressPercentage = maxSupply > 0 ? (totalSupply / maxSupply) * 100 : 99.77;

  // Dynamic color based on progress
  const getProgressColor = (percentage: number) => {
    if (percentage < 50) return 'from-green-500 to-green-600';
    if (percentage < 80) return 'from-yellow-500 to-yellow-600';
    return 'from-red-500 to-red-600';
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black relative overflow-hidden">
      {/* Glow Effect */}
      <div 
        className="absolute pointer-events-none" 
        style={{ 
          top: '10%',
          right: '5%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(37,99,235,0.5) 20%, rgba(29,78,216,0.4) 40%, transparent 70%)',
          transform: 'translate(50%, -50%)',
          zIndex: 0,
          filter: 'blur(80px)',
          opacity: 0.9
        }}>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <ScrollAnimation direction="bottom" delay={0}>
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 text-center">
              <div className="flex flex-col items-center justify-center gap-4 mb-6">
                <CountdownDisplay
                  days={timeLeft.days}
                  hours={timeLeft.hours}
                  minutes={timeLeft.minutes}
                  seconds={timeLeft.seconds}
                  showTitle={false}
                  showPrice={false}
                />
              </div>
              <ProgressBar 
                percentage={progressPercentage}
                className="mb-6"
                trackColor="bg-white/20"
                barColor={`bg-gradient-to-r ${getProgressColor(progressPercentage)}`}
              />
              <div className="flex justify-center">
                <PrimaryButton href="/buy" className="animate-bounce-gentle">
                  {t('joinNow')}
                </PrimaryButton>
              </div>
            </div>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}

