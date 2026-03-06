'use client';

import { useState, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { PageLayout } from '@/components/layouts/PageLayout';
import { WalletConnect } from '@/components/WalletConnect';
import { PageCard } from '@/components/ui/PageCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { getContract, prepareContractCall, sendTransaction, readContract, defineChain } from 'thirdweb';
import { createThirdwebClient } from 'thirdweb';
import { useActiveWalletChain, useSwitchActiveWalletChain } from 'thirdweb/react';
import { toast } from 'sonner';
import { STAKING_CONTRACT_ADDRESS, STAKING_CONTRACT_ABI, BUY_CONTRACT_ADDRESS, buy_ABI } from '@/lib/contracts';
import { 
  RocketIcon,
  StarIcon as TrophyIcon,
  BarChartIcon,
  CheckCircledIcon,
} from '@radix-ui/react-icons';
import { Lock, X, AlertTriangle } from 'lucide-react';
import { StakingPlansSection } from '@/components/StakingPlansSection';
import { useTranslations } from '@/lib/translation-provider';
import { usePageTracking, trackStakingEvent } from '@/hooks/usePageTracking';

// Define BSC chain for thirdweb
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
interface StakingPlan {
  id: number;
  name: string;
  lockPeriod: number; // in days
  apy: string;
  minStake: string;
  maxStake: string;
}

interface StakingPosition {
  positionId: number;
  amount: bigint;
  startTime: bigint;
  lockDuration: bigint;
  lockEndTime: bigint;
  lastRewardTime: bigint;
  accruedRewards: bigint;
  active: boolean;
  calculatedRewards?: bigint;
  isUnlocked?: boolean;
  remainingLockTime?: bigint;
}

const stakingPlans: StakingPlan[] = [
  {
    id: 2,
    name: 'Standard Node',
    lockPeriod: 30,
    apy: '350%',
    minStake: '100',
    maxStake: '100,000'
  },
  {
    id: 3,
    name: '3 Month Vault',
    lockPeriod: 90,
    apy: '400%',
    minStake: '500',
    maxStake: '500,000'
  },
  {
    id: 4,
    name: '6 Month Vault',
    lockPeriod: 180,
    apy: '480%',
    minStake: '1,000',
    maxStake: '1,000,000'
  },
  {
    id: 5,
    name: '12 Month Vault',
    lockPeriod: 360,
    apy: '490%',
    minStake: '5,000',
    maxStake: 'Unlimited'
  }
];

export default function StakingPage() {
  const { t } = useTranslations('staking');
  const account = useActiveAccount();
  const address = account?.address;
  const activeChain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();

  // Track page visit
  usePageTracking('staking', address);

  const [selectedPlan, setSelectedPlan] = useState<StakingPlan | null>(null);
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [stakedBalance, setStakedBalance] = useState<string>('0');
  const [pendingRewards, setPendingRewards] = useState<string>('0');
  const [totalEarned, setTotalEarned] = useState<string>('0');
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isClaiming, setIsClaiming] = useState(false); // Reserved for when rGGP launches
  const [isApproving, setIsApproving] = useState(false);
  const [tokenDecimals, setTokenDecimals] = useState<number>(18);
  const [tokenSymbol, setTokenSymbol] = useState<string>('TOKEN');
  const [hasApproval, setHasApproval] = useState(false);
  const [positions, setPositions] = useState<StakingPosition[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [unstakeConfirmation, setUnstakeConfirmation] = useState<{
    isOpen: boolean;
    positionId: number | null;
    stakedAmount: number;
  }>({
    isOpen: false,
    positionId: null,
    stakedAmount: 0,
  });

  const [earlyExitConfirmation, setEarlyExitConfirmation] = useState<{
    isOpen: boolean;
    positionId: number | null;
    stakedAmount: number;
  }>({
    isOpen: false,
    positionId: null,
    stakedAmount: 0,
  });

  const [isEarlyExiting, setIsEarlyExiting] = useState(false);

  const client = createThirdwebClient({
    clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "your-client-id"
  });

  // Helper function to add delay and avoid rate limits
  const delay = useCallback((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)), []);

  // Helper function to retry with exponential backoff
  const retryWithBackoff = useCallback(async (
    fn: () => Promise<unknown>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<unknown> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: unknown) {
        const isRateLimit = error instanceof Error && 
          (error.message.includes('rate limit') || error.message.includes('429') || error.message.includes('-32005'));
        
        if (isRateLimit && i < maxRetries - 1) {
          const delayMs = baseDelay * Math.pow(2, i);
          await delay(delayMs);
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  }, [delay]);

  // Load user's token balance
  const loadTokenBalance = useCallback(async () => {
    if (!address || !BUY_CONTRACT_ADDRESS) return;

    try {
      const tokenContract = getContract({
        client,
        address: BUY_CONTRACT_ADDRESS,
        chain: BSC_CHAIN,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: buy_ABI as any,
      });

      // Load with delays to avoid rate limiting
      const balance = await retryWithBackoff(() => 
        readContract({ contract: tokenContract, method: "balanceOf", params: [address] })
      );
      await delay(200); // Small delay between requests
      
      const decimals = await retryWithBackoff(() =>
        readContract({ contract: tokenContract, method: "decimals", params: [] })
      );
      await delay(200);
      
      const symbol = await retryWithBackoff(() =>
        readContract({ contract: tokenContract, method: "symbol", params: [] })
      );

      const balanceNumber = Number(balance) / Math.pow(10, Number(decimals));
      setTokenBalance(balanceNumber.toFixed(4));
      setTokenDecimals(Number(decimals));
      const symbolString = String(symbol);
      setTokenSymbol(symbolString);
      
      console.log('Token Symbol:', symbolString);
      console.log('Token balance loaded successfully:', {
        balance: balanceNumber.toFixed(4),
        symbol: symbolString,
        decimals: Number(decimals),
        address
      });
    } catch (error) {
      console.error('Error loading token balance:', error);
      // Don't show error toast for rate limit errors, just log it
      const isRateLimit = error instanceof Error && 
        (error.message.includes('rate limit') || error.message.includes('429') || error.message.includes('-32005'));
      if (!isRateLimit) {
        toast.error('Failed to load token balance');
      }
    }
  }, [address, client, retryWithBackoff, delay]);

  // Load staking data
  const loadStakingData = useCallback(async () => {
    if (!address || !STAKING_CONTRACT_ADDRESS) return;

    setLoadingPositions(true);
    try {
      const stakingContract = getContract({
        client,
        address: STAKING_CONTRACT_ADDRESS,
        chain: BSC_CHAIN,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: STAKING_CONTRACT_ABI as any,
      });

      // ===== DIAGNOSTIC CHECKS FOR REWARD SYSTEM =====
      console.log('=== STAKING REWARD SYSTEM DIAGNOSTICS ===');
      
      try {
        // Check 1: rewardActive()
        const rewardActive = await retryWithBackoff(() =>
          readContract({
            contract: stakingContract,
            method: "rewardActive",
            params: []
          })
        ).catch(() => false) as boolean;
        console.log('1. rewardActive():', rewardActive);
        
        await delay(200);

        // Check 2: rewardToken()
        const rewardToken = await retryWithBackoff(() =>
          readContract({
            contract: stakingContract,
            method: "rewardToken",
            params: []
          })
        ).catch(() => '0x0000000000000000000000000000000000000000') as string;
        console.log('2. rewardToken():', rewardToken);
        console.log('   - Is zero address?', rewardToken === '0x0000000000000000000000000000000000000000' || rewardToken === '0x0');
        
        await delay(200);

        // Check 3: currentEpochId()
        const currentEpochId = await retryWithBackoff(() =>
          readContract({
            contract: stakingContract,
            method: "currentEpochId",
            params: []
          })
        ).catch(() => BigInt(0)) as bigint;
        console.log('3. currentEpochId():', currentEpochId.toString());
        
        await delay(200);

        // Check 4: Epoch configuration (emissionRate, startTime, endTime)
        if (currentEpochId > BigInt(0)) {
          const epoch = await retryWithBackoff(() =>
            readContract({
              contract: stakingContract,
              method: "epochs",
              params: [currentEpochId]
            })
          ).catch(() => null) as {
            emissionRate: bigint;
            startTime: bigint;
            endTime: bigint;
          } | null;
          
          if (epoch) {
            console.log('4. Current Epoch Configuration:');
            console.log('   - emissionRate:', epoch.emissionRate.toString());
            console.log('   - startTime:', epoch.startTime.toString(), `(${new Date(Number(epoch.startTime) * 1000).toLocaleString()})`);
            console.log('   - endTime:', epoch.endTime.toString(), `(${new Date(Number(epoch.endTime) * 1000).toLocaleString()})`);
            
            const now = BigInt(Math.floor(Date.now() / 1000));
            const isEpochActive = now >= epoch.startTime && now <= epoch.endTime;
            console.log('   - Current time:', now.toString(), `(${new Date().toLocaleString()})`);
            console.log('   - Is epoch active?', isEpochActive);
            console.log('   - Time until start:', epoch.startTime > now ? `${(Number(epoch.startTime) - Number(now)) / 86400} days` : 'Already started');
            console.log('   - Time until end:', epoch.endTime > now ? `${(Number(epoch.endTime) - Number(now)) / 86400} days` : 'Already ended');
          } else {
            console.log('4. Current Epoch Configuration: FAILED TO LOAD');
          }
        } else {
          console.log('4. Current Epoch Configuration: No epoch ID (epochId is 0)');
        }

        // Additional checks
        await delay(200);
        const totalStaked = await retryWithBackoff(() =>
          readContract({
            contract: stakingContract,
            method: "totalStaked",
            params: []
          })
        ).catch(() => BigInt(0)) as bigint;
        console.log('5. totalStaked (contract):', totalStaked.toString());

        await delay(200);
        const globalRewardCap = await retryWithBackoff(() =>
          readContract({
            contract: stakingContract,
            method: "globalRewardCap",
            params: []
          })
        ).catch(() => BigInt(0)) as bigint;
        console.log('6. globalRewardCap:', globalRewardCap.toString());

        await delay(200);
        const totalRewardsMinted = await retryWithBackoff(() =>
          readContract({
            contract: stakingContract,
            method: "totalRewardsMinted",
            params: []
          })
        ).catch(() => BigInt(0)) as bigint;
        console.log('7. totalRewardsMinted:', totalRewardsMinted.toString());
        console.log('   - Remaining cap:', (globalRewardCap - totalRewardsMinted).toString());

        console.log('=== END DIAGNOSTICS ===\n');
      } catch (error) {
        console.error('Error running reward system diagnostics:', error);
      }
      // ===== END DIAGNOSTIC CHECKS =====

      await delay(300);

      // Get user's position IDs with retry
      const positionIds = await retryWithBackoff(() =>
        readContract({
          contract: stakingContract,
          method: "getUserPositions",
          params: [address]
        })
      ) as bigint[];

      if (!positionIds || positionIds.length === 0) {
        setPositions([]);
        setStakedBalance('0');
        setPendingRewards('0');
        setTotalEarned('0');
        setLoadingPositions(false);
        return;
      }

      await delay(300); // Delay after getting position IDs

      // Get total rewards for user with retry
      const totalRewards = await retryWithBackoff(() =>
        readContract({
          contract: stakingContract,
          method: "getUserTotalRewards",
          params: [address]
        })
      ).catch(() => BigInt(0)) as bigint;

      await delay(300); // Delay before loading positions

      // Load each position's details sequentially with delays to avoid rate limits
      const loadedPositions: StakingPosition[] = [];
      for (let i = 0; i < positionIds.length; i++) {
        const positionId = positionIds[i];
        
        try {
          // Get position data with retry
          const position = await retryWithBackoff(() =>
            readContract({
              contract: stakingContract,
              method: "getPosition",
              params: [positionId]
            })
          ) as {
            amount: bigint;
            startTime: bigint;
            lockDuration: bigint;
            lockEndTime: bigint;
            lastRewardTime: bigint;
            accruedRewards: bigint;
            active: boolean;
          };

          await delay(200); // Delay between position requests

          // Calculate current rewards for this position
          const calculatedRewards = await retryWithBackoff(() =>
            readContract({
              contract: stakingContract,
              method: "calculateRewards",
              params: [positionId]
            })
          ).catch(() => BigInt(0)) as bigint;

          // Log position reward details
          console.log(`\n--- Position ${positionId} Reward Details ---`);
          console.log('Position data:', {
            amount: position.amount.toString(),
            startTime: position.startTime.toString(),
            lockDuration: position.lockDuration.toString(),
            lockEndTime: position.lockEndTime.toString(),
            lastRewardTime: position.lastRewardTime.toString(),
            accruedRewards: position.accruedRewards.toString(),
            active: position.active
          });
          console.log('calculateRewards() result:', calculatedRewards.toString());
          const rewardsInTokens = Number(calculatedRewards) / Math.pow(10, tokenDecimals || 18);
          console.log('Rewards in tokens:', rewardsInTokens.toFixed(4));
          
          // Calculate time since last reward
          const now = BigInt(Math.floor(Date.now() / 1000));
          const timeSinceLastReward = now - position.lastRewardTime;
          const daysSinceLastReward = Number(timeSinceLastReward) / (24 * 60 * 60);
          console.log('Time since last reward:', `${daysSinceLastReward.toFixed(2)} days`);
          console.log('--- End Position Details ---\n');

          await delay(200);

          // Check if unlocked
          const isUnlocked = await retryWithBackoff(() =>
            readContract({
              contract: stakingContract,
              method: "isUnlocked",
              params: [positionId]
            })
          ).catch(() => false) as boolean;

          await delay(200);

          // Get remaining lock time
          const remainingLockTime = await retryWithBackoff(() =>
            readContract({
              contract: stakingContract,
              method: "getRemainingLockTime",
              params: [positionId]
            })
          ).catch(() => BigInt(0)) as bigint;

          loadedPositions.push({
            positionId: Number(positionId),
            ...position,
            calculatedRewards,
            isUnlocked,
            remainingLockTime
          });

          // Delay before next position (except for last one)
          if (i < positionIds.length - 1) {
            await delay(300);
          }
        } catch (error) {
          console.error(`Error loading position ${positionId}:`, error);
          // Continue with other positions even if one fails
        }
      }
      setPositions(loadedPositions);

      // Calculate totals from positions
      const totalStaked = loadedPositions
        .filter(p => p.active)
        .reduce((sum, p) => sum + p.amount, BigInt(0));
      
      const totalPendingRewards = loadedPositions
        .filter(p => p.active)
        .reduce((sum, p) => sum + (p.calculatedRewards || BigInt(0)), BigInt(0));

      // Use current tokenDecimals value (defaults to 18 if not yet loaded)
      const currentDecimals = tokenDecimals || 18;
      const stakedNum = Number(totalStaked) / Math.pow(10, currentDecimals);
      const rewardsNum = Number(totalPendingRewards) / Math.pow(10, currentDecimals);
      const earnedNum = Number(totalRewards) / Math.pow(10, currentDecimals);

      setPositions(loadedPositions);
      setStakedBalance(stakedNum.toFixed(4));
      setPendingRewards(rewardsNum.toFixed(4));
      setTotalEarned(earnedNum.toFixed(4));
    } catch (error) {
      console.error('Error loading staking data:', error);
      // Don't show error toast for rate limit errors
      const isRateLimit = error instanceof Error && 
        (error.message.includes('rate limit') || error.message.includes('429') || error.message.includes('-32005'));
      if (STAKING_CONTRACT_ADDRESS && !isRateLimit) {
        toast.error(t('loadStakingDataFailed') || 'Failed to load staking data');
      }
    } finally {
      setLoadingPositions(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, client, retryWithBackoff, delay]);

  // Check token approval
  const checkApproval = useCallback(async () => {
    if (!address || !BUY_CONTRACT_ADDRESS || !STAKING_CONTRACT_ADDRESS) return;

    try {
      const tokenContract = getContract({
        client,
        address: BUY_CONTRACT_ADDRESS,
        chain: BSC_CHAIN,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: buy_ABI as any,
      });

      const allowance = await readContract({
        contract: tokenContract,
        method: "allowance",
        params: [address, STAKING_CONTRACT_ADDRESS]
      });

      const stakeAmountWei = stakeAmount 
        ? BigInt(Math.floor(parseFloat(stakeAmount) * Math.pow(10, tokenDecimals)))
        : BigInt(0);

      setHasApproval(allowance >= stakeAmountWei && allowance > BigInt(0));
    } catch (error) {
      console.error('Error checking approval:', error);
      setHasApproval(false);
    }
  }, [address, stakeAmount, tokenDecimals, client]);

  // Approve tokens
  const approveTokens = async () => {
    if (!address || !account || !BUY_CONTRACT_ADDRESS || !STAKING_CONTRACT_ADDRESS) {
      toast.error(t('connectWalletFirst') || 'Please connect your wallet first');
      return;
    }

    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      toast.error(t('enterValidAmount') || 'Please enter a valid amount');
      return;
    }

    setIsApproving(true);

    try {
      const currentChainId = activeChain?.id;
      const BSC_CHAIN_ID = 56;

      if (currentChainId !== BSC_CHAIN_ID) {
        try {
          await switchChain(BSC_CHAIN);
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch {
          toast.error(t('switchChain') || 'Please switch to Binance Smart Chain (BSC) in your wallet to continue.');
          setIsApproving(false);
          return;
        }
      }

      const tokenContract = getContract({
        client,
        address: BUY_CONTRACT_ADDRESS,
        chain: BSC_CHAIN,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: buy_ABI as any,
      });

      const maxApproval = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

      const transaction = prepareContractCall({
        contract: tokenContract,
        method: "approve",
        params: [STAKING_CONTRACT_ADDRESS, maxApproval],
      });

      await sendTransaction({ transaction, account });
      toast.success(t('approvalSuccess') || 'Tokens approved successfully!');
      await checkApproval();
    } catch (error) {
      console.error('Error approving tokens:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to approve tokens';
      toast.error(errorMessage);
    } finally {
      setIsApproving(false);
    }
  };

  // Stake tokens
  const handleStake = async () => {
    if (!address || !account || !selectedPlan) {
      toast.error(t('connectWalletAndSelectPlan') || 'Please connect your wallet and select a staking plan');
      return;
    }

    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      toast.error(t('enterValidAmount') || 'Please enter a valid amount');
      return;
    }

    const stakeAmountNum = parseFloat(stakeAmount);
    const minStake = parseFloat(selectedPlan.minStake.replace(/,/g, ''));
    
    if (stakeAmountNum < minStake) {
      toast.error(t('minStakeError') || `Minimum stake amount is ${selectedPlan.minStake} ${tokenSymbol}`);
      return;
    }

    if (!hasApproval) {
      toast.error(t('approveTokensFirst') || 'Please approve tokens first');
      return;
    }

    setIsStaking(true);

    try {
      const currentChainId = activeChain?.id;
      const BSC_CHAIN_ID = 56;

      if (currentChainId !== BSC_CHAIN_ID) {
        try {
          await switchChain(BSC_CHAIN);
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch {
          toast.error('Please switch to Binance Smart Chain (BSC) in your wallet to continue.');
          setIsStaking(false);
          return;
        }
      }

      const stakingContract = getContract({
        client,
        address: STAKING_CONTRACT_ADDRESS,
        chain: BSC_CHAIN,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: STAKING_CONTRACT_ABI as any,
      });

      const amountWei = BigInt(Math.floor(stakeAmountNum * Math.pow(10, tokenDecimals)));
      
      // Convert lock period from days to seconds
      // Minimum 30 days as per contract requirements
      const lockPeriodDays = selectedPlan.lockPeriod || 30;
      const lockDurationSeconds = BigInt(lockPeriodDays * 24 * 60 * 60);

      const transaction = prepareContractCall({
        contract: stakingContract,
        method: "stake",
        params: [amountWei, lockDurationSeconds],
      });

      await sendTransaction({ transaction, account });
      toast.success('Staking Successful!', {
        description: `You have successfully staked ${stakeAmount} ${tokenSymbol} tokens.`,
      });
      
      // Track staking event for analytics
      trackStakingEvent(address, stakeAmountNum);
      
      setStakeAmount('');
      await loadTokenBalance();
      await loadStakingData();
      await checkApproval();
      
      // Sync staked amount to database - read from contract to get latest value
      try {
        // Wait a bit for the transaction to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get updated positions and calculate total staked
        const positionIds = await readContract({
          contract: stakingContract,
          method: "getUserPositions",
          params: [address]
        }) as bigint[];

        let totalStaked = BigInt(0);
        if (positionIds && positionIds.length > 0) {
          const positionPromises = positionIds.map(async (positionId) => {
            const position = await readContract({
              contract: stakingContract,
              method: "getPosition",
              params: [positionId]
            }) as { amount: bigint; active: boolean };
            return position;
          });
          const positions = await Promise.all(positionPromises);
          totalStaked = positions
            .filter(p => p.active)
            .reduce((sum, p) => sum + p.amount, BigInt(0));
        }
        
        const stakedBalanceValue = Number(totalStaked) / Math.pow(10, tokenDecimals);
        
        if (!isNaN(stakedBalanceValue) && stakedBalanceValue >= 0) {
          await fetch('/api/users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              address: address,
              action: 'sync-stake',
              stakedAmount: stakedBalanceValue,
            }),
          });
        }
      } catch (error) {
        console.error('Error syncing staked amount:', error);
        // Don't show error to user, just log it
      }
    } catch (error) {
      console.error('Error staking tokens:', error);
      let errorMessage = 'Failed to stake tokens';
      if (error instanceof Error) {
        const errorString = error.message;
        
        if (errorString.includes('user rejected') || errorString.includes('User rejected')) {
          errorMessage = 'Transaction was rejected. Please try again.';
        } else if (errorString.includes('insufficient funds') || errorString.includes('insufficient balance')) {
          errorMessage = 'Insufficient balance. Please ensure you have enough tokens and BNB for gas fees.';
        } else if (errorString.includes('allowance') || errorString.includes('approval')) {
          errorMessage = 'Token approval required. Please approve tokens first.';
        } else if (errorString.includes('AmountTooSmall') || errorString.includes('amount too small')) {
          errorMessage = `Minimum stake amount is ${selectedPlan.minStake} ${tokenSymbol}.`;
        } else {
          errorMessage = 'Failed to stake tokens. Please try again.';
        }
      }
      toast.error(t('stakingFailed') || 'Staking Failed', {
        description: errorMessage,
      });
    } finally {
      setIsStaking(false);
    }
  };

  // Claim rewards
  const handleClaimRewards = async () => {
    if (!address || !account) {
      toast.error(t('connectWalletFirst') || 'Please connect your wallet first');
      return;
    }

    setIsClaiming(true);

    try {
      const currentChainId = activeChain?.id;
      const BSC_CHAIN_ID = 56;

      if (currentChainId !== BSC_CHAIN_ID) {
        try {
          await switchChain(BSC_CHAIN);
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch {
          toast.error(t('switchChain') || 'Please switch to Binance Smart Chain (BSC) in your wallet to continue.');
          setIsClaiming(false);
          return;
        }
      }

      const stakingContract = getContract({
        client,
        address: STAKING_CONTRACT_ADDRESS,
        chain: BSC_CHAIN,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: STAKING_CONTRACT_ABI as any,
      });

      const transaction = prepareContractCall({
        contract: stakingContract,
        method: "claimAll",
        params: [],
      });

      await sendTransaction({ transaction, account });
      toast.success(t('rewardsClaimed') || 'Rewards Claimed!', {
        description: t('rewardsClaimedDesc') || 'Your staking rewards have been successfully claimed and added to your wallet.',
      });
      
      await loadStakingData();
      await loadTokenBalance();
    } catch (error) {
      console.error('Error claiming rewards:', error);
      let errorMessage = 'Failed to claim rewards';
      if (error instanceof Error) {
        const errorString = error.message;
        
        if (errorString.includes('user rejected') || errorString.includes('User rejected')) {
          errorMessage = 'Transaction was rejected. Please try again.';
        } else if (errorString.includes('insufficient funds') || errorString.includes('insufficient balance')) {
          errorMessage = 'Insufficient funds. Please ensure you have enough BNB for gas fees.';
        } else if (errorString.includes('NoRewards') || errorString.includes('no rewards')) {
          errorMessage = 'You do not have any rewards to claim at this time.';
        } else {
          errorMessage = 'Failed to claim rewards. Please try again.';
        }
      }
      toast.error(t('claimFailed') || 'Claim Failed', {
        description: errorMessage,
      });
    } finally {
      setIsClaiming(false);
    }
  };

  // Show unstake confirmation dialog
  const showUnstakeConfirmation = (positionId: number, stakedAmount: number) => {
    setUnstakeConfirmation({
      isOpen: true,
      positionId,
      stakedAmount,
    });
  };

  // Show early exit confirmation dialog
  const showEarlyExitConfirmation = (positionId: number, stakedAmount: number) => {
    setEarlyExitConfirmation({
      isOpen: true,
      positionId,
      stakedAmount,
    });
  };

  // Unstake tokens (called after confirmation)
  const handleUnstake = async (positionId: number) => {
    if (!address || !account) {
      toast.error(t('connectWalletFirst') || 'Please connect your wallet first');
      return;
    }

    // Close confirmation dialog
    setUnstakeConfirmation({ isOpen: false, positionId: null, stakedAmount: 0 });

    setIsUnstaking(true);

    try {
      const currentChainId = activeChain?.id;
      const BSC_CHAIN_ID = 56;

      if (currentChainId !== BSC_CHAIN_ID) {
        try {
          await switchChain(BSC_CHAIN);
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch {
          toast.error(t('switchChain') || 'Please switch to Binance Smart Chain (BSC) in your wallet to continue.');
          setIsUnstaking(false);
          return;
        }
      }

      const stakingContract = getContract({
        client,
        address: STAKING_CONTRACT_ADDRESS,
        chain: BSC_CHAIN,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: STAKING_CONTRACT_ABI as any,
      });

      // Check if position is unlocked
      const isUnlocked = await readContract({
        contract: stakingContract,
        method: "isUnlocked",
        params: [BigInt(positionId)]
      }) as boolean;

      if (!isUnlocked) {
        toast.error(t('positionLocked') || 'Position is still locked. You cannot unstake until the lock period ends.');
        setIsUnstaking(false);
        return;
      }

      const transaction = prepareContractCall({
        contract: stakingContract,
        method: "unstake",
        params: [BigInt(positionId)],
      });

      await sendTransaction({ transaction, account });
      toast.success(t('unstakingSuccess') || 'Unstaking Successful!', {
        description: t('unstakingSuccessDesc') || 'Your tokens have been successfully unstaked and returned to your wallet.',
      });
      
      await loadStakingData();
      await loadTokenBalance();
      
      // Sync staked amount to database - read from contract to get latest value
      try {
        // Wait a bit for the transaction to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get updated positions and calculate total staked
        const positionIds = await readContract({
          contract: stakingContract,
          method: "getUserPositions",
          params: [address]
        }) as bigint[];

        let totalStaked = BigInt(0);
        if (positionIds && positionIds.length > 0) {
          const positionPromises = positionIds.map(async (positionId) => {
            const position = await readContract({
              contract: stakingContract,
              method: "getPosition",
              params: [positionId]
            }) as { amount: bigint; active: boolean };
            return position;
          });
          const positions = await Promise.all(positionPromises);
          totalStaked = positions
            .filter(p => p.active)
            .reduce((sum, p) => sum + p.amount, BigInt(0));
        }
        
        const stakedBalanceValue = Number(totalStaked) / Math.pow(10, tokenDecimals);
        
        if (!isNaN(stakedBalanceValue) && stakedBalanceValue >= 0) {
          await fetch('/api/users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              address: address,
              action: 'sync-stake',
              stakedAmount: stakedBalanceValue,
            }),
          });
        }
      } catch (error) {
        console.error('Error syncing staked amount:', error);
        // Don't show error to user, just log it
      }
    } catch (error) {
      console.error('Error unstaking tokens:', error);
      let errorMessage = 'Failed to unstake tokens';
      if (error instanceof Error) {
        const errorString = error.message;
        
        if (errorString.includes('user rejected') || errorString.includes('User rejected')) {
          errorMessage = 'Transaction was rejected. Please try again.';
        } else if (errorString.includes('insufficient funds') || errorString.includes('insufficient balance')) {
          errorMessage = 'Insufficient funds. Please ensure you have enough BNB for gas fees.';
        } else if (errorString.includes('NotUnlocked') || errorString.includes('still locked')) {
          errorMessage = 'Position is still locked. You cannot unstake until the lock period ends.';
        } else {
          errorMessage = 'Failed to unstake tokens. Please try again.';
        }
      }
      toast.error(t('unstakingFailed') || 'Unstaking Failed', {
        description: errorMessage,
      });
    } finally {
      setIsUnstaking(false);
    }
  };

  // Early exit (unstake before lock period ends with penalty)
  const handleEarlyExit = async (positionId: number) => {
    if (!address || !account) {
      toast.error(t('connectWalletFirst') || 'Please connect your wallet first');
      return;
    }

    // Close confirmation dialog
    setEarlyExitConfirmation({ isOpen: false, positionId: null, stakedAmount: 0 });

    setIsEarlyExiting(true);

    try {
      const currentChainId = activeChain?.id;
      const BSC_CHAIN_ID = 56;

      if (currentChainId !== BSC_CHAIN_ID) {
        try {
          await switchChain(BSC_CHAIN);
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch {
          toast.error(t('switchChain') || 'Please switch to Binance Smart Chain (BSC) in your wallet to continue.');
          setIsEarlyExiting(false);
          return;
        }
      }

      const stakingContract = getContract({
        client,
        address: STAKING_CONTRACT_ADDRESS,
        chain: BSC_CHAIN,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: STAKING_CONTRACT_ABI as any,
      });

      const transaction = prepareContractCall({
        contract: stakingContract,
        method: "earlyExit",
        params: [BigInt(positionId)],
      });

      await sendTransaction({ transaction, account });
      toast.success(t('earlyExitSuccess') || 'Early Exit Successful!', {
        description: t('earlyExitSuccessDesc') || 'Your tokens have been unstaked early. A 10% penalty has been applied and sent to the treasury.',
      });
      
      await loadStakingData();
      await loadTokenBalance();
      
      // Sync staked amount to database - read from contract to get latest value
      try {
        // Wait a bit for the transaction to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get updated positions and calculate total staked
        const positionIds = await readContract({
          contract: stakingContract,
          method: "getUserPositions",
          params: [address]
        }) as bigint[];

        let totalStaked = BigInt(0);
        if (positionIds && positionIds.length > 0) {
          const positionPromises = positionIds.map(async (positionId) => {
            const position = await readContract({
              contract: stakingContract,
              method: "getPosition",
              params: [positionId]
            }) as { amount: bigint; active: boolean };
            return position;
          });
          const positions = await Promise.all(positionPromises);
          totalStaked = positions
            .filter(p => p.active)
            .reduce((sum, p) => sum + p.amount, BigInt(0));
        }
        
        const stakedBalanceValue = Number(totalStaked) / Math.pow(10, tokenDecimals);
        
        if (!isNaN(stakedBalanceValue) && stakedBalanceValue >= 0) {
          await fetch('/api/users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              address: address,
              action: 'sync-stake',
              stakedAmount: stakedBalanceValue,
            }),
          });
        }
      } catch (error) {
        console.error('Error syncing staked amount:', error);
        // Don't show error to user, just log it
      }
    } catch (error) {
      console.error('Error early exiting:', error);
      let errorMessage = 'Failed to early exit';
      if (error instanceof Error) {
        const errorString = error.message;
        
        if (errorString.includes('user rejected') || errorString.includes('User rejected')) {
          errorMessage = 'Transaction was rejected. Please try again.';
        } else if (errorString.includes('insufficient funds') || errorString.includes('insufficient balance')) {
          errorMessage = 'Insufficient funds. Please ensure you have enough BNB for gas fees.';
        } else if (errorString.includes('StillLocked') || errorString.includes('still locked')) {
          errorMessage = 'Unable to early exit. Please try again.';
        } else {
          errorMessage = 'Failed to early exit. Please try again.';
        }
      }
      toast.error(t('earlyExitFailed') || 'Early Exit Failed', {
        description: errorMessage,
      });
    } finally {
      setIsEarlyExiting(false);
    }
  };

  // Load data on mount and when address changes
  useEffect(() => {
    if (address) {
      loadTokenBalance();
      loadStakingData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    if (address && stakeAmount) {
      checkApproval();
    }
  }, [address, stakeAmount, checkApproval]);

  return (
    <PageLayout showStickyDisclaimer showDisclaimerBanner>
      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16">
        <div className="max-w-7xl mx-auto">
          <PageHeader 
            title={t('title')}
            description={t('subtitle')}
          />

          {/* Staking Plans Section */}
          <div className="mb-8 sm:mb-12">
            <StakingPlansSection />
          </div>

          {/* Wallet Connection */}
          <PageCard className="mb-6 sm:mb-8" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }}>
            <div className="text-center mb-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                {t('connectWallet')}
              </h2>
              <p className="text-slate-300">
                {t('connectWalletDesc') || 'Connect your wallet to start staking tokens'}
              </p>
            </div>
            <WalletConnect />
          </PageCard>

          {address && (
            <>
              {/* User Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 sm:mb-8">
                <PageCard style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }}>
                  <div className="text-center">
                    <div className="flex justify-center mb-2">
                      <BarChartIcon className="w-6 h-6 text-blue-400" />
                    </div>
                    <p className="text-slate-400 text-sm mb-1">{t('tokenBalance') || 'Token Balance'}</p>
                    <p className="text-white text-xl font-bold">{tokenBalance} {tokenSymbol}</p>
                  </div>
                </PageCard>

                <PageCard style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }}>
                  <div className="text-center">
                    <div className="flex justify-center mb-2">
                      <Lock className="w-6 h-6 text-green-400" />
                    </div>
                    <p className="text-slate-400 text-sm mb-1">{t('staked') || 'Staked'}</p>
                    <p className="text-white text-xl font-bold">{stakedBalance} {tokenSymbol}</p>
                  </div>
                </PageCard>

                <PageCard style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }}>
                  <div className="text-center">
                    <div className="flex justify-center mb-2">
                      <TrophyIcon className="w-6 h-6 text-yellow-400" />
                    </div>
                    <p className="text-slate-400 text-sm mb-1">{t('pendingRewards')}</p>
                    <p className="text-white text-xl font-bold">{pendingRewards} rGGP</p>
                  </div>
                </PageCard>

                <PageCard style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }}>
                  <div className="text-center">
                    <div className="flex justify-center mb-2">
                      <CheckCircledIcon className="w-6 h-6 text-purple-400" />
                    </div>
                    <p className="text-slate-400 text-sm mb-1">{t('totalEarned') || 'Total Earned'}</p>
                    <p className="text-white text-xl font-bold">{totalEarned} {tokenSymbol}</p>
                  </div>
                </PageCard>
              </div>

              {/* Staking Plans */}
              <PageCard className="mb-6 sm:mb-8" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }}>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4 text-center">
                  {t('selectPlan')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stakingPlans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        selectedPlan?.id === plan.id
                          ? 'border-blue-500 bg-blue-500/20'
                          : 'border-white/20 bg-white/5 hover:border-white/40'
                      }`}
                    >
                      <div className="text-center">
                        <h4 className="text-xl font-bold text-white mb-2">{plan.name}</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-400">{t('lockPeriod')}:</span>
                            <span className="text-white font-semibold">
                              {plan.lockPeriod} {t('days') || 'Days'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">{t('apy')}:</span>
                            <span className="text-blue-400 font-bold">{plan.apy}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">{t('minStake')}:</span>
                            <span className="text-white">{plan.minStake} {tokenSymbol}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </PageCard>

              {/* Staking Form */}
              {selectedPlan && (
                <PageCard className="mb-6 sm:mb-8" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }}>
                  <h3 className="text-2xl font-bold text-white mb-6 text-center">
                    {t('stakeTokens') || 'Stake Tokens'} - {selectedPlan.name}
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-slate-300 mb-2">
                        {t('stakeAmount')} ({tokenSymbol})
                      </label>
                      <input
                        type="number"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        min="0"
                        step="0.0001"
                      />
                      <div className="flex justify-between mt-2 text-sm text-slate-400">
                        <span>{t('available') || 'Available'}: {tokenBalance} {tokenSymbol}</span>
                        <button
                          onClick={() => setStakeAmount(tokenBalance)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          {t('max')}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {!hasApproval && stakeAmount && parseFloat(stakeAmount) > 0 && (
                        <button
                          onClick={approveTokens}
                          disabled={isApproving}
                          className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                        >
                          {isApproving ? t('approving') : t('approveToken')}
                        </button>
                      )}
                      <button
                        onClick={handleStake}
                        disabled={isStaking || !hasApproval || !stakeAmount || parseFloat(stakeAmount) <= 0}
                        className="flex-1 bg-linear-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                      >
                        {isStaking ? t('staking') : t('stake')}
                      </button>
                    </div>
                  </div>
                </PageCard>
              )}

              {/* Claim Rewards */}
              {parseFloat(pendingRewards) > 0 && (
                <PageCard className="mb-6 sm:mb-8" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">{t('claimRewards')}</h3>
                      <p className="text-slate-300">
                        {t('rewardsReady') || 'You have'} {pendingRewards} rGGP {t('readyToClaim') || 'ready to claim'}
                      </p>
                      <p className="text-yellow-400 text-sm mt-2">
                        {t('claimingDisabled') || 'Claiming is disabled until rGGP launches'}
                      </p>
                    </div>
                    <button
                      onClick={handleClaimRewards}
                      disabled={true}
                      className="bg-gray-500 text-white px-6 py-3 rounded-lg font-semibold transition-all opacity-50 cursor-not-allowed"
                    >
                      {t('claimDisabled') || 'Claim Disabled'}
                    </button>
                  </div>
                </PageCard>
              )}

              {/* Active Stakes */}
              {positions.length > 0 && (
                <PageCard style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }}>
                  <h3 className="text-2xl font-bold text-white mb-6 text-center">
                    {t('yourStakes')}
                  </h3>
                  {loadingPositions ? (
                    <div className="text-center p-8">
                      <p className="text-slate-300">{t('loadingPositions') || 'Loading positions...'}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {positions
                        .filter(p => p.active)
                        .map((position) => {
                          const amount = Number(position.amount) / Math.pow(10, tokenDecimals);
                          const rewards = Number(position.calculatedRewards || BigInt(0)) / Math.pow(10, tokenDecimals);
                          const lockEndDate = new Date(Number(position.lockEndTime) * 1000);
                          const remainingDays = position.remainingLockTime 
                            ? Math.ceil(Number(position.remainingLockTime) / (24 * 60 * 60))
                            : 0;
                          const isUnlocked = position.isUnlocked || false;

                          return (
                            <div
                              key={position.positionId}
                              className="p-4 rounded-lg border border-white/20 bg-white/5"
                            >
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                  <p className="text-slate-400 text-sm mb-1">{t('positionId') || 'Position ID'}</p>
                                  <p className="text-white font-semibold">#{position.positionId}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400 text-sm mb-1">{t('stakedAmount')}</p>
                                  <p className="text-white font-semibold">{amount.toFixed(4)} {tokenSymbol}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400 text-sm mb-1">{t('pendingRewards')}</p>
                                  <p className="text-yellow-400 font-semibold">{rewards.toFixed(4)} rGGP</p>
                                </div>
                                <div>
                                  <p className="text-slate-400 text-sm mb-1">{t('lockStatus') || 'Lock Status'}</p>
                                  <p className={`font-semibold ${isUnlocked ? 'text-green-400' : 'text-orange-400'}`}>
                                    {isUnlocked ? t('unlocked') || 'Unlocked' : `${t('locked') || 'Locked'} (${remainingDays}d)`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {rewards > 0 && (
                                  <button
                                    disabled={true}
                                    className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg font-semibold transition-all opacity-50 cursor-not-allowed"
                                    title={t('claimingDisabled')}
                                  >
                                    {t('claimDisabled') || 'Claim Disabled'}
                                  </button>
                                )}
                                {isUnlocked ? (
                                  <button
                                    onClick={() => showUnstakeConfirmation(position.positionId, amount)}
                                    disabled={isUnstaking}
                                    className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isUnstaking ? t('unstaking') : t('unstake')}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => showEarlyExitConfirmation(position.positionId, amount)}
                                    disabled={isEarlyExiting}
                                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isEarlyExiting ? t('earlyExiting') || 'Early Exiting...' : t('earlyExit') || 'Early Exit'}
                                  </button>
                                )}
                              </div>
                              {!isUnlocked && (
                                <p className="text-yellow-400 text-sm mt-2">
                                  {t('lockEnds') || 'Lock ends'}: {lockEndDate.toLocaleDateString()} {lockEndDate.toLocaleTimeString()}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      {positions.filter(p => p.active).length === 0 && (
                        <div className="text-center p-8">
                          <p className="text-slate-300">{t('noActivePositions') || 'No active staking positions'}</p>
                        </div>
                      )}
                    </div>
                  )}
                </PageCard>
              )}
            </>
          )}

          {/* Unstake Confirmation Dialog */}
          {unstakeConfirmation.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setUnstakeConfirmation({ isOpen: false, positionId: null, stakedAmount: 0 })}
              />

              {/* Modal */}
              <div className="relative bg-slate-800 rounded-xl border-2 border-red-500/50 shadow-2xl max-w-md w-full mx-4 p-6 z-50">
                {/* Close button */}
                <button
                  onClick={() => setUnstakeConfirmation({ isOpen: false, positionId: null, stakedAmount: 0 })}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Content */}
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="flex justify-center mb-4">
                      <AlertTriangle className="w-12 h-12 text-red-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">{t('unstakeWarning') || 'Warning: Unstaking'}</h3>
                    <p className="text-slate-300 text-sm">
                      {t('unstakeWarningDesc') || 'You are about to unstake your tokens.'}
                    </p>
                  </div>

                  <div className="bg-slate-700/50 border border-slate-600/30 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">{t('stakedAmount')}:</span>
                      <span className="text-white font-semibold">
                        {unstakeConfirmation.stakedAmount.toFixed(4)} {tokenSymbol}
                      </span>
                    </div>
                    <div className="border-t border-slate-600/30 pt-3 flex justify-between items-center">
                      <span className="text-slate-300 font-semibold">{t('youWillReceive') || 'You will receive'}:</span>
                      <span className="text-green-400 font-bold text-lg">
                        {unstakeConfirmation.stakedAmount.toFixed(4)} {tokenSymbol}
                      </span>
                    </div>
                  </div>

                  <p className="text-yellow-400 text-sm text-center">
                    {t('unstakeConfirm') || 'Are you sure you want to proceed? This action cannot be undone.'}
                  </p>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setUnstakeConfirmation({ isOpen: false, positionId: null, stakedAmount: 0 })}
                      className="flex-1 bg-slate-600 hover:bg-slate-700 text-white px-4 py-3 rounded-lg font-semibold transition-all"
                    >
                      {t('cancel') || 'Cancel'}
                    </button>
                    <button
                      onClick={() => {
                        if (unstakeConfirmation.positionId !== null) {
                          handleUnstake(unstakeConfirmation.positionId);
                        }
                      }}
                      disabled={isUnstaking}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                    >
                      {isUnstaking ? t('unstaking') : t('confirmUnstake') || 'Confirm Unstake'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Early Exit Confirmation Dialog */}
          {earlyExitConfirmation.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setEarlyExitConfirmation({ isOpen: false, positionId: null, stakedAmount: 0 })}
              />

              {/* Modal */}
              <div className="relative bg-slate-800 rounded-xl border-2 border-orange-500/50 shadow-2xl max-w-md w-full mx-4 p-6 z-50">
                {/* Close button */}
                <button
                  onClick={() => setEarlyExitConfirmation({ isOpen: false, positionId: null, stakedAmount: 0 })}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Content */}
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="flex justify-center mb-4">
                      <AlertTriangle className="w-12 h-12 text-orange-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">{t('earlyExitWarning') || 'Warning: Early Exit Penalty'}</h3>
                    <p className="text-slate-300 text-sm">
                      {t('earlyExitWarningDesc') || 'You are about to unstake your tokens before the lock period ends. Please be aware of the following:'}
                    </p>
                  </div>

                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">{t('stakedAmount')}:</span>
                      <span className="text-white font-semibold">
                        {earlyExitConfirmation.stakedAmount.toFixed(4)} {tokenSymbol}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">{t('penalty') || 'Penalty (10%)'}:</span>
                      <span className="text-orange-400 font-semibold">
                        -{(earlyExitConfirmation.stakedAmount * 0.1).toFixed(4)} {tokenSymbol}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 text-center pt-1">
                      {t('penaltyToTreasury') || 'This penalty will be sent to the treasury'}
                    </div>
                    <div className="border-t border-orange-500/30 pt-3 flex justify-between items-center">
                      <span className="text-slate-300 font-semibold">{t('youWillReceive') || 'You will receive'}:</span>
                      <span className="text-green-400 font-bold text-lg">
                        {(earlyExitConfirmation.stakedAmount * 0.9).toFixed(4)} {tokenSymbol}
                      </span>
                    </div>
                  </div>

                  <p className="text-yellow-400 text-sm text-center">
                    {t('earlyExitConfirm') || 'Are you sure you want to proceed? This action cannot be undone.'}
                  </p>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setEarlyExitConfirmation({ isOpen: false, positionId: null, stakedAmount: 0 })}
                      className="flex-1 bg-slate-600 hover:bg-slate-700 text-white px-4 py-3 rounded-lg font-semibold transition-all"
                    >
                      {t('cancel') || 'Cancel'}
                    </button>
                    <button
                      onClick={() => {
                        if (earlyExitConfirmation.positionId !== null) {
                          handleEarlyExit(earlyExitConfirmation.positionId);
                        }
                      }}
                      disabled={isEarlyExiting}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                    >
                      {isEarlyExiting ? t('earlyExiting') || 'Early Exiting...' : t('confirmEarlyExit') || 'Confirm Early Exit'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info Section */}
          <PageCard className="mt-6 sm:mt-8" style={{ backgroundColor: 'rgba(30, 41, 59, 0.3)', borderColor: 'rgba(71, 85, 105, 0.2)' }}>
            <h3 className="text-2xl font-bold text-white mb-6 text-center">
              How Token Staking Works
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className="p-4 bg-blue-500/20 rounded-full border border-blue-400/30">
                    <Lock className="w-8 h-8 text-blue-400" />
                  </div>
                </div>
                <h4 className="text-lg font-bold text-white">Choose Plan</h4>
                <p className="text-slate-300 text-sm">
                  Select a staking plan that fits your investment strategy
                </p>
              </div>
              <div className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className="p-4 bg-green-500/20 rounded-full border border-green-400/30">
                    <RocketIcon className="w-8 h-8 text-green-400" />
                  </div>
                </div>
                <h4 className="text-lg font-bold text-white">Stake Tokens</h4>
                <p className="text-slate-300 text-sm">
                  Approve and stake your tokens to start earning rewards
                </p>
              </div>
              <div className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className="p-4 bg-yellow-500/20 rounded-full border border-yellow-400/30">
                    <TrophyIcon className="w-8 h-8 text-yellow-400" />
                  </div>
                </div>
                <h4 className="text-lg font-bold text-white">Earn Rewards</h4>
                <p className="text-slate-300 text-sm">
                  Accumulate rewards over time and claim when ready
                </p>
              </div>
            </div>
          </PageCard>
        </div>
      </main>
    </PageLayout>
  );
}

