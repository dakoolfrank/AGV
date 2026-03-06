'use client';

import { ScrollAnimation } from '@/components/ScrollAnimation';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CountdownDisplay } from '@/components/ui/CountdownDisplay';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useCountdown } from '@/hooks/useCountdown';
import { usePresaleContract } from '@/hooks/usePresaleContract';
import { useState, useEffect } from 'react';
import { Rocket, Sparkles } from 'lucide-react';
import { useTranslations } from '@/lib/translation-provider';

export function FOMOSection() {
  const { t } = useTranslations('fomoSection');
  const timeLeft = useCountdown();
  const { 
    presaleRemaining, 
    presaleSold, 
    presaleActive, 
    presaleSupplyCap,
    isLoading: isContractLoading 
  } = usePresaleContract();

  const [recentPurchases, setRecentPurchases] = useState<string[]>([]);

  // Calculate data from contract or use defaults
  const maxSupply = presaleSupplyCap ? Number(presaleSupplyCap) / 1e18 : 70000000;
  const totalSupply = presaleSold ? Number(presaleSold) / 1e18 : 69842000;
  const progressPercentage = maxSupply > 0 ? (totalSupply / maxSupply) * 100 : 99.77;
  const nextPrice = '$0.010';

  // Simulate floating purchase notifications
  useEffect(() => {
    const interval = setInterval(() => {
      const randomAmount = Math.floor(Math.random() * 10000) + 1000;
      const randomWallet = `0x${Math.random().toString(16).substr(2, 8)}...${Math.random().toString(16).substr(2, 4)}`;
      const newPurchase = t('purchaseNotification', { wallet: randomWallet, amount: randomAmount.toLocaleString() });
      
      setRecentPurchases((prev) => {
        const updated = [newPurchase, ...prev].slice(0, 10); // Keep only last 10
        return updated;
      });
    }, 8000); // New purchase every 8 seconds

    return () => clearInterval(interval);
  }, [t]);

  // Dynamic color based on progress
  const getProgressColor = (percentage: number) => {
    if (percentage < 50) return 'from-green-500 to-green-600';
    if (percentage < 80) return `from-[#4FACFE] to-[#3d8bc4]`;
    return 'from-red-500 to-red-600';
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, rgba(34, 50, 86, 0.6), rgba(34, 50, 86, 0.9))' }}>
      <div className="max-w-7xl mx-auto relative z-10">
        <ScrollAnimation direction="bottom" delay={0}>
          <h4 className="text-lg md:text-2xl lg:text-3xl font-bold text-white text-center mb-12">
            {t('title')}
          </h4>
        </ScrollAnimation>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch auto-rows-fr">
          {/* Left: Progress + Countdown */}
          <ScrollAnimation direction="left" delay={200}>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 h-full flex flex-col">
              <div className="mb-6">
                <ProgressBar 
                  percentage={progressPercentage}
                  className="mb-4"
                  trackColor="bg-white/20"
                  barColor={`bg-gradient-to-r ${getProgressColor(progressPercentage)}`}
                />
                <div className="text-center space-y-2">
                  <p className="text-white text-lg font-mono">
                    {t('soldProgress', { sold: totalSupply.toLocaleString(undefined, { maximumFractionDigits: 0 }), max: maxSupply.toLocaleString(undefined, { maximumFractionDigits: 0 }), percentage: progressPercentage.toFixed(2) })}
                  </p>
                  <p className="text-lg font-semibold" style={{ color: '#4FACFE' }}>
                    {t('nextRound', { price: nextPrice, hours: timeLeft.hours, minutes: timeLeft.minutes })}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <CountdownDisplay
                  days={timeLeft.days}
                  hours={timeLeft.hours}
                  minutes={timeLeft.minutes}
                  seconds={timeLeft.seconds}
                  showTitle={false}
                  showPrice={false}
                />
              </div>

              <PrimaryButton href="/buy" className="w-full text-lg py-4 animate-glow flex items-center justify-center gap-2">
                <Rocket className="w-5 h-5 inline" /> {t('ctaButton')}
              </PrimaryButton>
            </div>
          </ScrollAnimation>

          {/* Right: Floating Purchase Notifications */}
          <ScrollAnimation direction="right" delay={400}>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 h-full flex flex-col">
              <h3 className="text-xl font-bold text-white mb-6 text-center shrink-0">{t('livePurchaseFeed')}</h3>
              <div className="space-y-3 relative grow" style={{ minHeight: '300px' }}>
                {recentPurchases.map((purchase, index) => (
                  <div
                    key={index}
                    className="bg-green-500/20 backdrop-blur-sm rounded-lg p-4 border border-green-400/30 animate-fade-in-up"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <p className="text-green-300 text-sm font-mono flex items-center gap-2">
                      <Sparkles className="w-4 h-4 shrink-0" /> {purchase}
                    </p>
                  </div>
                ))}
                {recentPurchases.length === 0 && (
                  <div className="text-center text-white/50 py-12">
                    <p>{t('waitingForPurchases')}</p>
                  </div>
                )}
              </div>
            </div>
          </ScrollAnimation>
        </div>
      </div>
    </section>
  );
}

