'use client';

import { useState, useEffect } from 'react';
import { ScrollAnimation } from '@/components/ScrollAnimation';
import { ExclamationTriangleIcon, CheckCircledIcon, BarChartIcon } from '@radix-ui/react-icons';
import { CountdownDisplay } from '@/components/ui/CountdownDisplay';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useCountdown } from '@/hooks/useCountdown';
import { usePresaleContract } from '@/hooks/usePresaleContract';
import { Leaderboard } from '@/components/Leaderboard';
import { useActiveAccount } from 'thirdweb/react';
import { useTranslations } from '@/lib/translation-provider';

const MAIN_TOKEN_PREVIEW_PRICE = 0.50;

export function InfoSection() {
  const { t } = useTranslations('info');
  const timeLeft = useCountdown();
  const account = useActiveAccount();
  const address = account?.address;
  const { 
    presaleRemaining, 
    presaleSold, 
    presaleActive, 
    presaleSupplyCap,
    isLoading: isContractLoading 
  } = usePresaleContract();

  // Fetch activation count for progress bar
  const [activationCount, setActivationCount] = useState(0);
  const [isLoadingCount, setIsLoadingCount] = useState(true);
  const [activeLeaderboard, setActiveLeaderboard] = useState<'buyer' | 'claim-referral' | 'activation' | 'kol-referral'>('kol-referral');
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  useEffect(() => {
    const fetchActivationCount = async () => {
      try {
        const response = await fetch('/api/users?action=activation-count');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setActivationCount(data.data.activationCount);
          }
        }
      } catch (error) {
        console.error('Failed to fetch activation count:', error);
      } finally {
        setIsLoadingCount(false);
      }
    };

    fetchActivationCount();
  }, []);

  // Fetch leaderboard data based on active leaderboard type
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoadingLeaderboard(true);
      try {
        if (activeLeaderboard === 'kol-referral') {
          // Fetch KOL referral leaderboard
          const response = await fetch('/api/kol-referral-leaderboard');
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              // Ensure all entries have required properties and add rank
              const validData = data.data
                .filter((entry: any) => entry && entry.wallet)
                .map((entry: any, index: number) => ({
                  ...entry,
                  rank: index + 1
                }));
              setLeaderboardData(validData);
            } else {
              setLeaderboardData([]);
            }
          } else {
            setLeaderboardData([]);
          }
        } else if (activeLeaderboard === 'claim-referral') {
          // Fetch Claim Referral leaderboard (claimer referrals)
          const response = await fetch('/api/claim-referral-leaderboard');
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              // Ensure all entries have required properties
              const validData = data.data.filter((entry: any) => entry && entry.wallet);
              setLeaderboardData(validData);
            } else {
              setLeaderboardData([]);
            }
          } else {
            setLeaderboardData([]);
          }
        } else if (activeLeaderboard === 'buyer') {
          // Fetch Buyer leaderboard (from purchases collection)
          const response = await fetch('/api/buyer-leaderboard');
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              // Ensure all entries have required properties
              const validData = data.data.filter((entry: any) => entry && entry.wallet);
              setLeaderboardData(validData);
            } else {
              setLeaderboardData([]);
            }
          } else {
            setLeaderboardData([]);
          }
        } else if (activeLeaderboard === 'activation') {
          // Fetch Activation leaderboard (from users collection)
          const response = await fetch(`/api/users?type=activation`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              // Ensure all entries have required properties
              const validData = data.data.filter((entry: any) => entry && entry.address);
              setLeaderboardData(validData);
            } else {
              setLeaderboardData([]);
            }
          } else {
            setLeaderboardData([]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      } finally {
        setIsLoadingLeaderboard(false);
      }
    };

    fetchLeaderboard();
    // Refresh every 60 seconds
    const interval = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(interval);
  }, [activeLeaderboard]);

  // Use contract data if available, otherwise fallback to defaults
  const totalAllocation = presaleSupplyCap ? Number(presaleSupplyCap) / 1e18 : 5000000;
  const contractSold = presaleSold ? Number(presaleSold) / 1e18 : 0;
  const contractRemaining = presaleRemaining ? Number(presaleRemaining) / 1e18 : 0;
  
  // Use contract sold data, but also consider activation count for display
  const currentAllocated = contractSold > 0 ? contractSold : (activationCount * 1000);
  const progressPercentage = totalAllocation > 0 ? (currentAllocated / totalAllocation) * 100 : 0;

  // Current Phase Data
  const currentPhaseData = [
    {
      stage: 'Genesis Seed',
      price: '$0.005',
      amount: '1,000,000',
      raise: '$5,000',
      percentage: '20%',
      purpose: 'OG & NFT redemption promise'
    },
    {
      stage: 'Community Early',
      price: '$0.010',
      amount: '2,000,000',
      raise: '$20,000',
      percentage: '40%',
      purpose: 'Matches MOU stage; whitelist open'
    },
    {
      stage: 'Public Flash Sale',
      price: '$0.015',
      amount: '2,000,000',
      raise: '$30,000',
      percentage: '40%',
      purpose: 'Matches on-chain stage; burn unsold'
    }
  ];

  // Price Route Table Data
  const priceRouteData = [
    {
      stage: 'Pre-Token',
      coreEvent: 'preGVT 3 tiers ($0.005→$0.015)',
      targetBand: '$0.005–$0.015',
      rationale: 'Entry phase; build holder base with low float'
    },
    {
      stage: 'MOU',
      coreEvent: '6 MWp node MOU + site photos',
      targetBand: '$0.03–$0.05',
      rationale: 'First physical DePIN asset verified'
    },
    {
      stage: 'On-Chain',
      coreEvent: 'Energy/compute data live on-chain & dashboard',
      targetBand: '$0.05–$0.07',
      rationale: 'Output verification, anti-"story only"'
    },
    {
      stage: 'Audit Sign/Submit',
      coreEvent: 'Publish audit hash',
      targetBand: '$0.07–$0.08',
      rationale: 'Trust expectation established'
    },
    {
      stage: 'Audit Passed + Swap',
      coreEvent: '1:1 preGVT→GVT',
      targetBand: '$0.08–$0.10',
      rationale: 'Trust delivered'
    },
    {
      stage: 'Tier-2 CEX',
      coreEvent: 'Gate/Bitmart listing',
      targetBand: '$0.10–$0.15',
      rationale: 'Liquidity & price discovery'
    },
    {
      stage: 'Tier-1 CEX',
      coreEvent: 'OKX/Binance/Launchpad',
      targetBand: '$0.15–$0.20+',
      rationale: 'Market expansion'
    }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black relative overflow-hidden">
      {/* Glow Effect */}
      <div 
        className="absolute pointer-events-none" 
        style={{ 
          top: '30%',
          right: '15%',
          width: '650px',
          height: '650px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(37,99,235,0.5) 20%, rgba(29,78,216,0.4) 40%, transparent 70%)',
          transform: 'translate(50%, -50%)',
          zIndex: 0,
          filter: 'blur(90px)',
          opacity: 0.9
        }}>
      </div>
      <div className="max-w-7xl mx-auto relative z-10 space-y-16">
        
        {/* Container 1: 2 Columns - Countdown + Value Proposition */}
        <ScrollAnimation direction="bottom" delay={0}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center justify-items-center">
            {/* Column 1: Countdown - Original Design */}
            <ScrollAnimation direction="bottom" delay={200}>
              <CountdownDisplay
                days={timeLeft.days}
                hours={timeLeft.hours}
                minutes={timeLeft.minutes}
                seconds={timeLeft.seconds}
                actionButton={
                  <PrimaryButton href="/buy" className="animate-bounce-gentle">
                    {t('buyTokens')}
                  </PrimaryButton>
                }
                contractAddress="0xa9E59e7990cBFcD5B62aBB12703F0E3a12141C06"
              />
            </ScrollAnimation>

            {/* Column 2: Value Proposition */}
            <div className="text-center lg:text-left">
              <h3 className="text-2xl font-bold text-white mb-4">{t('valueTitle')} <span className="text-blue-400 italic">{t('valueTitleHighlight')}</span></h3>
              <p className="text-white text-base leading-relaxed mb-6">
                {t('valueDescription')}
              </p>
              <PrimaryButton href="https://www.agvprotocol.org/en/blog" external>
                {t('learnMore')}
              </PrimaryButton>
            </div>
          </div>
        </ScrollAnimation>

        {/* Container 2: 3 Columns - Warning Boxes */}
        <ScrollAnimation direction="bottom" delay={200}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1: Financial Disclaimer */}
            <div className="bg-red-500/20 backdrop-blur-sm rounded-xl p-6 border-2 border-red-500/50">
              <div className="flex items-center mb-4">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-400 mr-2" />
                <h4 className="text-red-300 font-semibold text-lg">{t('financialDisclaimer')}</h4>
              </div>
              <p className="text-red-200 text-sm leading-relaxed">
                {t('financialDisclaimerDesc')}
              </p>
            </div>

            {/* Column 2: Investment Warning */}
            <div className="bg-red-500/20 backdrop-blur-sm rounded-xl p-6 border-2 border-red-500/50">
              <div className="flex items-center mb-4">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-400 mr-2" />
                <h4 className="text-red-300 font-semibold text-lg">{t('investmentWarning')}</h4>
              </div>
              <p className="text-red-200 text-sm leading-relaxed">
                {t('investmentWarningDesc')}
              </p>
            </div>

            {/* Column 3: Target Bands & Metrics */}
            <div className="bg-yellow-500/20 backdrop-blur-sm rounded-xl p-6 border-2 border-yellow-500/50">
              <div className="flex items-center mb-4">
                <CheckCircledIcon className="w-6 h-6 text-yellow-400 mr-2" />
                <h4 className="text-yellow-300 font-semibold text-lg">{t('targetBands')}</h4>
              </div>
              <p className="text-yellow-200 text-sm leading-relaxed">
                {t('targetBandsDesc')}
              </p>
            </div>
          </div>
        </ScrollAnimation>

        {/* Container 3: Current Table */}
        <ScrollAnimation direction="bottom" delay={400}>
          <div className="text-center mb-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              <span className="text-blue-400 italic">{t('publicPriceRoute')}</span>
            </h2>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-8 border border-white/20 overflow-x-auto">
            <div className="min-w-full">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-4 px-4 text-white font-bold">{t('tableHeaders.stage')}</th>
                    <th className="text-left py-4 px-4 text-white font-bold">{t('tableHeaders.coreEvent')}</th>
                    <th className="text-left py-4 px-4 text-white font-bold">{t('tableHeaders.targetBand')}</th>
                    <th className="text-left py-4 px-4 text-white font-bold">{t('tableHeaders.rationale')}</th>
                  </tr>
                </thead>
                <tbody>
                  {priceRouteData.map((row, index) => (
                    <tr key={index} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-2 sm:py-4 sm:px-4 text-blue-200 text-xs sm:text-sm font-semibold">{row.stage}</td>
                      <td className="py-3 px-2 sm:py-4 sm:px-4 text-white text-xs sm:text-sm">{row.coreEvent}</td>
                      <td className="py-3 px-2 sm:py-4 sm:px-4 text-green-400 font-bold text-xs sm:text-sm">{row.targetBand}</td>
                      <td className="py-3 px-2 sm:py-4 sm:px-4 text-slate-300 text-xs sm:text-sm">{row.rationale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollAnimation>

        {/* Container 4: Current Progress Bar */}
        <ScrollAnimation direction="bottom" delay={800}>
          <div className="text-center mb-8">
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
              <span className="text-blue-400 italic">{t('phase1Title') || 'Phase-1 Three-Tier Pre-Sale'}</span>
              <br />
              {t('phase1Subtitle') || '(Low Float, High Elasticity)'}
            </h3>
            <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 backdrop-blur-sm rounded-2xl p-6 border border-green-400/30">
              <div className="flex items-center justify-center mb-4">
                <BarChartIcon className="w-6 h-6 text-green-400 mr-2" />
                <span className="text-green-300 text-lg font-semibold">
                  {t('progress') || 'Progress'}: {isLoadingCount ? t('loading') || 'Loading...' : `${progressPercentage.toFixed(1)}%`}
                </span>
              </div>
              <ProgressBar
                percentage={progressPercentage}
                showPercentage={false}
                trackColor="bg-slate-700/50"
              />
              <p className="text-slate-300 text-sm">
                {isContractLoading ? t('loading') || 'Loading...' : `${currentAllocated.toLocaleString(undefined, { maximumFractionDigits: 0 })} / ${totalAllocation.toLocaleString(undefined, { maximumFractionDigits: 0 })} preGVT ${t('sold') || 'sold'}`}
              </p>
              <p className="text-slate-400 text-xs mt-2">
                {isContractLoading ? t('loading') || 'Loading...' : contractRemaining > 0 
                  ? `${contractRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} preGVT ${t('remaining') || 'remaining'}`
                  : `${activationCount} ${t('activations') || 'activations'}`
                }
              </p>
              {presaleActive !== null && (
                <p className="text-blue-400 text-xs mt-1">
                  {t('status') || 'Status'}: {presaleActive ? `🟢 ${t('presaleActive') || 'Presale Active'}` : `🔴 ${t('presaleInactive') || 'Presale Inactive'}`}
                </p>
              )}
            </div>
          </div>
        </ScrollAnimation>

        {/* Current Phase Table */}
        <ScrollAnimation direction="bottom" delay={600}>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-8 border border-white/20 overflow-x-auto">
            <div className="min-w-full">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-4 px-4 text-white font-bold">{t('tableHeaders.stage')}</th>
                    <th className="text-left py-4 px-4 text-white font-bold">{t('price') || 'Price'}</th>
                    <th className="text-left py-4 px-4 text-white font-bold">{t('amount') || 'Amount'}</th>
                    <th className="text-left py-4 px-4 text-white font-bold">{t('raise') || 'Raise'}</th>
                    <th className="text-left py-4 px-4 text-white font-bold">%</th>
                    <th className="text-left py-4 px-4 text-white font-bold">{t('purpose') || 'Purpose'}</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPhaseData.map((phase, index) => (
                    <tr key={index} className="hover:bg-white/5 transition-colors animate-bounce-in" style={{ animationDelay: `${index * 0.1}s` }}>
                      <td className="py-3 px-2 sm:py-4 sm:px-4 text-blue-200 text-xs sm:text-sm font-semibold">{phase.stage}</td>
                      <td className="py-3 px-2 sm:py-4 sm:px-4 text-green-400 font-bold text-xs sm:text-sm">{phase.price}</td>
                      <td className="py-3 px-2 sm:py-4 sm:px-4 text-white font-mono text-xs sm:text-sm">{phase.amount}</td>
                      <td className="py-3 px-2 sm:py-4 sm:px-4 text-white font-bold text-xs sm:text-sm">{phase.raise}</td>
                      <td className="py-3 px-2 sm:py-4 sm:px-4 text-yellow-400 font-bold text-xs sm:text-sm">{phase.percentage}</td>
                      <td className="py-3 px-2 sm:py-4 sm:px-4 text-slate-300 text-xs sm:text-sm">{phase.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 pt-4 border-t border-white/20">
                <p className="text-center text-slate-300 text-sm">
                  <strong className="text-white">{t('totals') || 'Totals'}:</strong> 5,000,000 preGVT; {t('target') || 'target'} ≈ $55,000
                </p>
              </div>
            </div>
          </div>
        </ScrollAnimation>

        {/* Main Token Preview Section */}
        <ScrollAnimation direction="bottom" delay={900}>
          <div className="bg-gradient-to-r from-purple-500/20 to-indigo-500/20 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-purple-400/30">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center mb-4">
                <h3 className="text-2xl sm:text-3xl font-bold text-white">
                  {t('mainTokenPreview') || 'Main Token Preview'}
                </h3>
              </div>
              
              <div className="mb-4">
                <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-purple-300 mb-2">
                  ${MAIN_TOKEN_PREVIEW_PRICE.toFixed(2)} USD
                </div>
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/50">
                  <span className="text-purple-200 text-xs sm:text-sm font-medium">
                    {t('fixedPreviewPrice') || 'Fixed Preview Price · Non-Tradable'}
                  </span>
                </div>
              </div>

              <div className="max-w-2xl mx-auto mt-6">
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                  {t('mainTokenPreviewDesc')}
                </p>
              </div>
            </div>
          </div>
        </ScrollAnimation>

        {/* Leaderboard Switching */}
        <ScrollAnimation direction="bottom" delay={1000}>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white mb-4 sm:mb-0">{t('leaderboards') || 'Leaderboards'}</h3>
              <div className="flex space-x-2 flex-wrap gap-2">
                <button
                  onClick={() => setActiveLeaderboard('kol-referral')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeLeaderboard === 'kol-referral'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  {t('kolReferrals') || 'KOL Referrals'}
                </button>
                <button
                  onClick={() => setActiveLeaderboard('buyer')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeLeaderboard === 'buyer'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  {t('buyer') || 'Buyer'}
                </button>
                <button
                  onClick={() => setActiveLeaderboard('claim-referral')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeLeaderboard === 'claim-referral'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  {t('claimReferrals') || 'Claim Referrals'}
                </button>
                <button
                  onClick={() => setActiveLeaderboard('activation')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeLeaderboard === 'activation'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  {t('activation') || 'Activation'}
                </button>
              </div>
            </div>
            <Leaderboard 
              leaderboard={leaderboardData}
              isLoading={isLoadingLeaderboard}
              type={activeLeaderboard}
              currentAddress={address}
            />
          </div>
        </ScrollAnimation>

      </div>
    </section>
  );
}

