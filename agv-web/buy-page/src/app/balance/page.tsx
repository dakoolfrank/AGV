'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { PageLayout } from '@/components/layouts/PageLayout';
import { WalletConnect } from '@/components/WalletConnect';
import { PageCard } from '@/components/ui/PageCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { useUserData } from '@/hooks/useUserData';
import { Leaderboard } from '@/components/Leaderboard';
import { VestingSchedule } from '@/components/VestingSchedule';
import { useTranslations } from '@/lib/translation-provider';
import { 
  BUY_CONTRACT_ADDRESS, 
  buy_ABI
} from '@/lib/contracts';
import { getContract, readContract, defineChain } from 'thirdweb';
import { createThirdwebClient } from 'thirdweb';
import { toast } from 'sonner';
import { 
  CheckCircledIcon, 
  StarIcon as DollarSignIcon,
  StarIcon as TrophyIcon,
  StarIcon as TrendingUpIcon,
  StarIcon as LockIcon,
} from '@radix-ui/react-icons';

// Constants
const BSC_CHAIN = defineChain({
  id: 56,
  name: "Binance Smart Chain",
  nativeCurrency: {
    name: "BNB",
    symbol: "BNB",
    decimals: 18,
  },
  rpc: "https://bsc-dataseed.binance.org/",
  blockExplorers: [
    {
      name: "BSCScan",
      url: "https://bscscan.com",
    },
  ],
});

const TOKEN_DECIMALS = 18;

const RPC_ENDPOINTS = [
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.defibit.io/",
  "https://bsc-dataseed1.ninicoin.io/",
  "https://bsc-dataseed2.defibit.io/"
];

export default function BalancePage() {
  const { t } = useTranslations('balance');
  const account = useActiveAccount();
  const address = account?.address;
  
  const { 
    userData, 
    leaderboard, 
    isLoading, 
    fetchLeaderboard,
  } = useUserData();
  
  // Balance state
  const [preGVTBalance, setPreGVTBalance] = useState<bigint | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [pricePerToken, setPricePerToken] = useState<number | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  

  // Create thirdweb client (memoized)
  const client = useMemo(
    () => createThirdwebClient({
      clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "your-client-id"
    }),
    []
  );

  // Load price per token from contract
  const loadPriceData = useCallback(async () => {
    if (!address || !BUY_CONTRACT_ADDRESS) {
      setPricePerToken(null);
      return;
    }

    setIsLoadingPrice(true);
    try {
      let contract = null;
      let workingRpc = null;
      
      for (const rpc of RPC_ENDPOINTS) {
        try {
          const testChain = defineChain({
            ...BSC_CHAIN,
            rpc: rpc,
          });
          
          contract = getContract({
            client,
            address: BUY_CONTRACT_ADDRESS,
            chain: testChain,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            abi: buy_ABI as any,
          });
          
          // Test this RPC with a simple call
          await readContract({
            contract,
            method: "pricePerToken",
            params: [],
          });
          
          workingRpc = rpc;
          break;
        } catch {
          continue;
        }
      }
      
      if (!contract || !workingRpc) {
        setPricePerToken(null);
        return;
      }

      const price = await readContract({
        contract,
        method: "pricePerToken",
        params: [],
      });
      
      // Convert from wei (18 decimals)
      const priceInUSDT = Number(price) / 10 ** TOKEN_DECIMALS;
      setPricePerToken(priceInUSDT);
    } catch (err) {
      console.error('Error loading price:', err);
      setPricePerToken(null);
    } finally {
      setIsLoadingPrice(false);
    }
  }, [address, client]);

  // Load preGVT balance from contract
  const loadPreGVTBalance = useCallback(async () => {
    if (!address || !BUY_CONTRACT_ADDRESS) {
      setPreGVTBalance(null);
      return;
    }

    setIsLoadingBalance(true);
    try {
      let contract = null;
      let workingRpc = null;
      
      for (const rpc of RPC_ENDPOINTS) {
        try {
          const testChain = defineChain({
            ...BSC_CHAIN,
            rpc: rpc,
          });
          
          contract = getContract({
            client,
            address: BUY_CONTRACT_ADDRESS,
            chain: testChain,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            abi: buy_ABI as any,
          });
          
          // Test this RPC with a simple call
          await readContract({
            contract,
            method: "presaleActive",
            params: [],
          });
          
          workingRpc = rpc;
          break;
        } catch {
          continue;
        }
      }
      
      if (!contract || !workingRpc) {
        setPreGVTBalance(null);
        return;
      }

      const balance = await readContract({
        contract,
        method: "balanceOf",
        params: [address],
      });

      setPreGVTBalance(balance as bigint);
    } catch (err) {
      console.error('Error loading preGVT balance:', err);
      setPreGVTBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [address, client]);


  // Load data when address changes
  useEffect(() => {
    if (address) {
      loadPreGVTBalance();
      loadPriceData();
    }
  }, [address, loadPreGVTBalance, loadPriceData]);

  // Fetch leaderboard on mount
  useEffect(() => {
    fetchLeaderboard('buyer');
  }, [fetchLeaderboard]);

  // Calculate derived values
  const formattedBalance = useMemo(() => {
    if (preGVTBalance === null) return '0';
    return (Number(preGVTBalance) / 10 ** TOKEN_DECIMALS).toFixed(2);
  }, [preGVTBalance]);

  const totalValue = useMemo(() => {
    if (!preGVTBalance || !pricePerToken) return 0;
    return (Number(preGVTBalance) / 10 ** TOKEN_DECIMALS) * pricePerToken;
  }, [preGVTBalance, pricePerToken]);

  const userRank = useMemo(() => {
    if (!address) return 'N/A';
    return leaderboard.find(entry => entry.address === address)?.rank || 'N/A';
  }, [address, leaderboard]);


  return (
    <PageLayout showStickyDisclaimer showDisclaimerBanner>
      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16">
        <div className="max-w-6xl mx-auto">
          <PageHeader 
            title={t('title')}
            description={t('subtitle')}
          />

          {/* Wallet Connection Section */}
          <PageCard className="mb-6 sm:mb-8" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }}>
            <div className="text-center mb-4 sm:mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 sm:mb-3">
                Wallet Connection
              </h2>
              <p className="text-slate-300 text-base sm:text-lg px-4">
                {t('connectWallet')}
              </p>
            </div>
            <WalletConnect />
          </PageCard>

          {/* User Balance Section */}
          {address && (
            <>
              <PageCard style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }} className="mb-6 sm:mb-8">
                <div className="flex items-center mb-4 sm:mb-6">
                  <div className="p-2 sm:p-3 bg-primary/20 rounded-full border border-primary/30 mr-3 sm:mr-4">
                    <DollarSignIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white">{t('preGVTBalance')}</h3>
                </div>
                
                {isLoadingBalance ? (
                  <div className="text-center space-y-3 sm:space-y-4">
                    <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-primary border-t-transparent mx-auto"></div>
                    <p className="text-slate-300 text-sm sm:text-base">{t('loadingBalance')}</p>
                  </div>
                ) : (
                  <div>
                    <div className="text-center mb-6 sm:mb-8">
                      <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-green-400 mb-2 sm:mb-3">
                        {formattedBalance} preGVT
                      </div>
                      <p className="text-slate-300 text-base sm:text-lg">
                        {isLoadingPrice ? (
                          <span className="text-slate-400">Loading price...</span>
                        ) : (
                          `≈ $${totalValue.toFixed(2)} USD`
                        )}
                      </p>
                      {preGVTBalance !== null && (
                        <p className="text-blue-400 text-xs sm:text-sm mt-2">
                          {t('balanceFromContract')}
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex justify-between items-center p-2 sm:p-3 bg-slate-700/50 rounded-xl border border-slate-600/30">
                        <span className="text-slate-300 flex items-center text-sm sm:text-base">
                          <CheckCircledIcon className="w-4 h-4 mr-2 text-green-400 shrink-0" />
                          {t('redeemed')}:
                        </span>
                        <span className="text-white font-semibold text-sm sm:text-base">
                          {userData?.redeemedAmount?.toFixed(1) || 0} preGVT
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-2 sm:p-3 bg-slate-700/50 rounded-xl border border-slate-600/30">
                        <span className="text-slate-300 flex items-center text-sm sm:text-base">
                          <TrendingUpIcon className="w-4 h-4 mr-2 text-blue-400 shrink-0" />
                          {t('accrued')}:
                        </span>
                        <span className="text-white font-semibold text-sm sm:text-base">
                          {userData?.accruedAmount?.toFixed(1) || 0} preGVT
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-2 sm:p-3 bg-slate-700/50 rounded-xl border border-slate-600/30">
                        <span className="text-slate-300 flex items-center text-sm sm:text-base">
                          <TrophyIcon className="w-4 h-4 mr-2 text-yellow-400 shrink-0" />
                          {t('yourRank')}:
                        </span>
                        <span className="text-yellow-400 font-semibold text-sm sm:text-base">
                          #{userRank}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </PageCard>

              {/* Vesting Schedule Section */}
              {address && (
                <VestingSchedule walletAddress={address} />
              )}

            </>
          )}

          {/* Leaderboard Section */}
          <PageCard style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }}>
            <Leaderboard 
              leaderboard={leaderboard} 
              isLoading={isLoading} 
              type="buyer"
              currentAddress={address}
            />
          </PageCard>

          {/* Staking Call to Action */}
          <PageCard className="my-6 sm:mb-8" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: 'rgba(96, 165, 250, 0.3)' }}>
            <div className="text-center space-y-4 sm:space-y-6 px-4">
              <div className="flex justify-center">
                <div className="p-4 sm:p-6 bg-primary/20 rounded-full border border-primary/30">
                  <LockIcon className="w-12 h-12 sm:w-16 sm:h-16 text-primary" />
                </div>
              </div>
              <div>
                <h4 className="text-2xl sm:text-3xl font-bold text-white mb-2 sm:mb-3">
                  {t('stakingCTA.title')}
                </h4>
                <p className="text-slate-300 text-base sm:text-lg mb-4 sm:mb-6">
                  {t('stakingCTA.description')}
                </p>
                <a
                  href="/staking"
                  className="inline-block bg-gradient-to-r from-primary to-primary/80 text-white px-6 sm:px-10 py-3 sm:py-4 rounded-xl text-base sm:text-lg font-semibold hover:from-primary/80 hover:to-primary transition-all duration-300 shadow-lg hover:shadow-primary/25 transform hover:scale-105"
                >
                  <LockIcon className="w-4 h-4 sm:w-5 sm:h-5 inline mr-2" />
                  {t('stakingCTA.goToStaking')}
                </a>
              </div>
            </div>
          </PageCard>
        </div>
      </main>
    </PageLayout>
  );
}
