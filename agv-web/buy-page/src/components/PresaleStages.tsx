'use client';

import { useState, useEffect } from 'react';
import { ScrollAnimation } from '@/components/ScrollAnimation';
import { 
  BarChartIcon,
  ExclamationTriangleIcon
} from '@radix-ui/react-icons';

export function PresaleStages() {
  const [activeLeaderboard, setActiveLeaderboard] = useState<'activations' | 'buyers' | 'referrals'>('activations');
  const [activationCount, setActivationCount] = useState(0);
  const [isLoadingCount, setIsLoadingCount] = useState(true);

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

  const totalAllocation = 5000000;
  // Progress based on activations: each activation represents 1000 preGVT allocated
  const currentAllocated = activationCount * 1000;
  const progressPercentage = (currentAllocated / totalAllocation) * 100;

  // Fetch activation count on component mount
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

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1639762681485-074b7f938ba0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80")'
        }}
      ></div>
      
      <div className="max-w-7xl mx-auto relative z-10 space-y-16">
        
        {/* Price Route Table */}
        <ScrollAnimation direction="bottom" delay={0}>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-pulse-slow">
              Public Price Route (One-Pager Visual Table)
            </h2>
          </div>
        </ScrollAnimation>

        <ScrollAnimation direction="left" delay={200}>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-8 border border-white/20 overflow-x-auto">
            <div className="min-w-full">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-4 px-4 text-white font-bold">Stage</th>
                    <th className="text-left py-4 px-4 text-white font-bold">Core Event</th>
                    <th className="text-left py-4 px-4 text-white font-bold">Target Band (USD)</th>
                    <th className="text-left py-4 px-4 text-white font-bold">Rationale</th>
                  </tr>
                </thead>
                <tbody>
                  {priceRouteData.map((row, index) => (
                    <tr key={index} className="border-b border-white/10 hover:bg-white/5 transition-colors animate-bounce-in" style={{ animationDelay: `${index * 0.1}s` }}>
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

        {/* Current Phase Section */}
        <ScrollAnimation direction="bottom" delay={400}>
          <div className="text-center mb-8">
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Phase-1 Three-Tier Pre-Sale (Low Float, High Elasticity)
            </h3>
            <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 backdrop-blur-sm rounded-2xl p-6 border border-green-400/30">
              <div className="flex items-center justify-center mb-4">
                <BarChartIcon className="w-6 h-6 text-green-400 mr-2" />
                <span className="text-green-300 text-lg font-semibold">
                  Progress: {isLoadingCount ? 'Loading...' : `${progressPercentage.toFixed(1)}%`}
                </span>
              </div>
              <div className="w-full bg-slate-700/50 rounded-full h-4 mb-4">
                <div 
                  className="bg-gradient-to-r from-green-500 to-blue-500 h-4 rounded-full transition-all duration-1000"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <p className="text-slate-300 text-sm">
                {isLoadingCount ? 'Loading...' : `${currentAllocated.toLocaleString()} / ${totalAllocation.toLocaleString()} preGVT allocated`}
              </p>
              <p className="text-slate-400 text-xs mt-2">
                {isLoadingCount ? 'Loading...' : `${activationCount} activations`}
              </p>
            </div>
          </div>
        </ScrollAnimation>

        <ScrollAnimation direction="right" delay={600}>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-8 border border-white/20 overflow-x-auto">
            <div className="min-w-full">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-4 px-4 text-white font-bold">Stage</th>
                    <th className="text-left py-4 px-4 text-white font-bold">Price</th>
                    <th className="text-left py-4 px-4 text-white font-bold">Amount</th>
                    <th className="text-left py-4 px-4 text-white font-bold">Raise</th>
                    <th className="text-left py-4 px-4 text-white font-bold">%</th>
                    <th className="text-left py-4 px-4 text-white font-bold">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPhaseData.map((phase, index) => (
                    <tr key={index} className="border-b border-white/10 hover:bg-white/5 transition-colors animate-bounce-in" style={{ animationDelay: `${index * 0.1}s` }}>
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
                  <strong className="text-white">Totals:</strong> 5,000,000 preGVT; target ≈ $55,000
                </p>
              </div>
            </div>
          </div>
        </ScrollAnimation>
        {/* Leaderboard Switching */}
        <ScrollAnimation direction="bottom" delay={1200}>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white mb-4 sm:mb-0">Leaderboards</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveLeaderboard('activations')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeLeaderboard === 'activations'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  Activations
                </button>
                <button
                  onClick={() => setActiveLeaderboard('buyers')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeLeaderboard === 'buyers'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  Buyers
                </button>
                <button
                  onClick={() => setActiveLeaderboard('referrals')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeLeaderboard === 'referrals'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  Referrals
                </button>
              </div>
            </div>
            <div className="text-center py-8">
              <p className="text-slate-300">
                {activeLeaderboard === 'activations' && 'Top 1000 wallet activations will be displayed here'}
                {activeLeaderboard === 'buyers' && 'Top buyers by volume will be displayed here'}
                {activeLeaderboard === 'referrals' && 'Top referrals by count will be displayed here'}
              </p>
            </div>
          </div>
        </ScrollAnimation>

        {/* Risk Disclosure */}
        <ScrollAnimation direction="bottom" delay={1400}>
          <div className="bg-red-500/10 backdrop-blur-sm rounded-2xl p-6 border border-red-400/30">
            <div className="flex items-center mb-4">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-400 mr-2" />
              <h4 className="text-red-300 font-semibold text-lg">Risk Disclosure</h4>
            </div>
            <p className="text-red-200 text-sm">
              <strong>Target Band ≠ guaranteed return</strong> - All price targets are estimates based on project milestones and market conditions. 
              Actual token prices may vary significantly. Please conduct your own research and invest responsibly.
            </p>
          </div>
        </ScrollAnimation>

      </div>
    </section>
  );
}
