'use client';

import { ScrollAnimation } from '@/components/ScrollAnimation';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useCountdown } from '@/hooks/useCountdown';
import { usePresaleContract } from '@/hooks/usePresaleContract';
import { useState, useEffect } from 'react';
import { DollarSign, Clock, Users } from 'lucide-react';
import { useTranslations } from '@/lib/translation-provider';

export function HeroSection() {
  const { t } = useTranslations('hero');
  const { 
    presaleSold, 
    presaleSupplyCap
  } = usePresaleContract();

  const timeLeft = useCountdown();
  const [walletCount, setWalletCount] = useState(10351); // Default value

  // Calculate data from contract or use defaults
  const maxSupply = presaleSupplyCap ? Number(presaleSupplyCap) / 1e18 : 70000000;
  const totalSupply = presaleSold ? Number(presaleSold) / 1e18 : 69842000;
  const progressPercentage = maxSupply > 0 ? (totalSupply / maxSupply) * 100 : 99.77;
  
  // Calculate next price tier (example: $0.010)
  const nextPrice = '$0.010';


  // Format time left for next price tier
  const nextPriceTime = `${timeLeft.hours}h ${timeLeft.minutes}m`;

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden min-h-[90vh] flex items-center bg-black">
      {/* Background Image */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url("/HERO_SECTION.png")'
        }}
      ></div>
      
      <div className="relative z-10 max-w-7xl mx-auto w-full">
        {/* Main Hero Content - Center Aligned */}
        <ScrollAnimation direction="bottom" delay={0}>
          <div className="text-center mb-12 max-w-5xl mx-auto">
            {/* Title with Real Assets in blue gradient box */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              {t('title')}{' '}
              <span className="inline-block px-4 py-2 rounded-lg bg-gradient-to-r from-blue-400 to-blue-600 text-white">
                {t('realAssets')}
              </span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-lg sm:text-lg md:text-xl text-white/90 mb-4 leading-relaxed">
              {t('subtitle')}
            </p>
            
            {/* Bold and italic text */}
            <p className="text-lg sm:text-xl md:text-2xl font-bold italic text-white mb-8">
              {t('tagline')}
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <PrimaryButton href="/buy" className="text-lg sm:text-xl px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white">
                {t('joinPresale')}
              </PrimaryButton>
              <a 
                href="https://www.agvprotocol.org/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-lg sm:text-xl px-8 py-4 border-2 border-white text-white hover:bg-white/10 transition-colors rounded-lg"
              >
                {t('learnMore')}
              </a>
            </div>
            
            {/* Ticker Line */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-3 mb-8 border border-white/20 inline-block">
              <p className="text-white text-sm sm:text-base font-mono flex items-center justify-center gap-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-primary" /> 
                  {t('ticker.sold', { 
                    sold: totalSupply.toLocaleString(undefined, { maximumFractionDigits: 0 }),
                    max: maxSupply.toLocaleString(undefined, { maximumFractionDigits: 0 }),
                    percentage: progressPercentage.toFixed(2)
                  })}
                </span> | 
                <span className="flex items-center gap-1">
                  <Clock className="w-4 text-primary h-4" /> 
                  {t('ticker.nextPrice', { price: nextPrice, time: nextPriceTime })}
                </span> | 
                <span className="flex items-center gap-1">
                  <Users className="w-4 text-primary h-4" /> 
                  {t('ticker.walletsJoined', { count: walletCount.toLocaleString() })}
                </span>
              </p>
            </div>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
