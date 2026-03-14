'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { PageLayout } from '@/components/layouts/PageLayout';
import { WalletConnect } from '@/components/WalletConnect';
import { PageCard } from '@/components/ui/PageCard';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  CrossCircledIcon,
  CheckCircledIcon,
  ClockIcon,
  RocketIcon,
} from '@radix-ui/react-icons';
import { BUY_CONTRACT_ADDRESS, buy_ABI, AIRDROP_BADGE_CONTRACT, AIRDROP_BADGE_ABI, AIRDROP_BADGE_ID } from '@/lib/contracts';
import { getContract, prepareContractCall, sendTransaction, readContract, defineChain } from 'thirdweb';
import { createThirdwebClient } from 'thirdweb';
import { checkTokenBalance } from '@/lib/utils';
import { useWhitelist } from '@/hooks/useWhitelist';
import { useActiveWalletChain, useSwitchActiveWalletChain } from 'thirdweb/react';
import { Leaderboard } from '@/components/Leaderboard';
import { SocialVerification } from '@/components/SocialVerification';
import { ClaimFOMOBanner } from '@/components/ClaimFOMOBanner';
import { ClaimStepper, StepStatus } from '@/components/ClaimStepper';
import { toast } from 'sonner';
import { useTranslations } from '@/lib/translation-provider';
import { usePageTracking } from '@/hooks/usePageTracking';

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

const IS_CLAIM_ACTIVE = true;

function DiscordErrorHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const discordError = searchParams?.get('discord_error');
    const discordInvite = searchParams?.get('discord_invite');

    if (discordError) {
      const errorMessage = decodeURIComponent(discordError);
      const inviteLink = discordInvite ? decodeURIComponent(discordInvite) : null;

      if (inviteLink) {
        toast.error('Discord Verification Failed', {
          description: `${errorMessage} Click the button below to join our Discord server.`,
          duration: 10000,
          action: {
            label: 'Join Discord Server',
            onClick: () => {
              window.open(inviteLink, '_blank', 'noopener,noreferrer');
            },
          },
        });
      } else {
        toast.error('Discord Verification Failed', {
          description: errorMessage,
          duration: 5000,
        });
      }

      const url = new URL(window.location.href);
      url.searchParams.delete('discord_error');
      url.searchParams.delete('discord_invite');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  return null;
}

function ClaimPageContent() {
  const { t } = useTranslations('claim');
  const account = useActiveAccount();
  const activeChain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
  const address = account?.address;

  usePageTracking('claim', address);

  const [isClaiming, setIsClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingSupply, setIsCheckingSupply] = useState(false);
  const [isCheckingClaimStatus, setIsCheckingClaimStatus] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [hasMinimumBalance, setHasMinimumBalance] = useState(false);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [claimableAmount, setClaimableAmount] = useState<bigint | null>(null);
  const [isCheckingClaimable, setIsCheckingClaimable] = useState(false);

  const { isWhitelisted, isLoading: isCheckingWhitelist } = useWhitelist();

  type Stage = 'socials' | 'verify' | 'badge' | 'allocation' | 'redeem';
  const [currentStage, setCurrentStage] = useState<Stage>('socials');
  const [isDeterminingStage, setIsDeterminingStage] = useState(true);

  const [socialsJoined, setSocialsJoined] = useState(false);
  const [socialsVerified, setSocialsVerified] = useState(false);
  const [badgeClaimed, setBadgeClaimed] = useState(false);
  const [allocationClaimed, setAllocationClaimed] = useState(false);
  const [badgeRedeemed, setBadgeRedeemed] = useState(false);
  const [badgeBalance, setBadgeBalance] = useState<bigint>(BigInt(0));
  const [isCheckingBadge, setIsCheckingBadge] = useState(false);
  const [badgeConfig, setBadgeConfig] = useState<{
    claimOpen: boolean;
    redeemOpen: boolean;
    claimPrice: bigint;
    paused: boolean;
  } | null>(null);
  const [isClaimingBadge, setIsClaimingBadge] = useState(false);
  const [isRedeemingBadge, setIsRedeemingBadge] = useState(false);
  const [discordVerified, setDiscordVerified] = useState(false);
  const [twitterVisited, setTwitterVisited] = useState(false);
  const [isLinkingDiscord, setIsLinkingDiscord] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [totalClaimed, setTotalClaimed] = useState<number>(0);
  const [isLoadingTotalClaimed, setIsLoadingTotalClaimed] = useState(false);
  const [isRefreshingEligibility, setIsRefreshingEligibility] = useState(false);
  
  const TOTAL_SUPPLY = 20000;

  interface ClaimReferralEntry {
    wallet: string;
    totalAmount: number;
    referralCount: number;
    rank?: number;
  }

  const [leaderboard, setLeaderboard] = useState<ClaimReferralEntry[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);

  const fetchClaimReferralLeaderboard = useCallback(async () => {
    setIsLeaderboardLoading(true);
    try {
      const response = await fetch('/api/claim-referral-leaderboard');

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setLeaderboard(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch claim referral leaderboard:', error);
    } finally {
      setIsLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClaimReferralLeaderboard();
    // Refresh every 60 seconds
    const interval = setInterval(fetchClaimReferralLeaderboard, 60000);
    return () => clearInterval(interval);
  }, [fetchClaimReferralLeaderboard]);

  // Fetch total claimed count
  const fetchTotalClaimed = useCallback(async () => {
    setIsLoadingTotalClaimed(true);
    try {
      // Query users with hasClaimed = true
      const response = await fetch('/api/users?action=claim-count');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.claimCount !== undefined) {
          setTotalClaimed(data.data.claimCount);
        }
      }
    } catch (error) {
      console.error('Failed to fetch total claimed:', error);
    } finally {
      setIsLoadingTotalClaimed(false);
    }
  }, []);

  useEffect(() => {
    fetchTotalClaimed();
    const interval = setInterval(fetchTotalClaimed, 30000);
    return () => clearInterval(interval);
  }, [fetchTotalClaimed]);

  const checkBNBBalanceForWallet = useCallback(async () => {
    if (!address) return;

    setIsCheckingBalance(true);
    setBalanceError(null);
    setError(null);
    try {
      const balanceData = await checkTokenBalance(address);
      setHasMinimumBalance(balanceData.hasMinimumBalance);

      if (balanceData.error) {
        setBalanceError(balanceData.error);
      }
    } catch {
      setHasMinimumBalance(false);
      setBalanceError('Failed to check BNB balance. Please try again.');
    } finally {
      setIsCheckingBalance(false);
    }
  }, [address]);

  const checkBadgeAvailability = useCallback(async () => {
    if (!address) return;

    setIsCheckingSupply(true);
    try {
      const client = createThirdwebClient({
        clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "your-client-id"
      });

      const rpcEndpoints = [
        "https://bsc-dataseed.binance.org/",
        "https://bsc-dataseed1.defibit.io/",
        "https://bsc-dataseed1.ninicoin.io/",
        "https://bsc-dataseed2.defibit.io/"
      ];

      let buyContract = null;

      for (const rpc of rpcEndpoints) {
        try {
          const testChain = defineChain({
            ...BSC_CHAIN,
            rpc: rpc,
          });

          buyContract = getContract({
            client,
            address: BUY_CONTRACT_ADDRESS,
            chain: testChain,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            abi: buy_ABI as any,
          });

          await readContract({
            contract: buyContract,
            method: "paused",
            params: [],
          });

          break;
        } catch {
          continue;
        }
      }

      if (!buyContract) {
        return;
      }

      try {
        await readContract({
          contract: buyContract,
          method: "paused",
          params: [],
        });
      } catch {
        return;
      }
    } catch {
    } finally {
      setIsCheckingSupply(false);
    }
  }, [address]);

  const checkClaimStatus = useCallback(async () => {
    if (!address) return;

    setIsCheckingClaimStatus(true);
    try {
      const apiUrl = `/api/users?address=${address}`;
      const response = await fetch(apiUrl);

      if (response.status === 404) {
        setHasClaimed(false);
        return;
      }

      const data = await response.json();

      if (data.success && data.data) {
        const claimed = data.data.hasClaimed || false;
        setHasClaimed(claimed);
        setAllocationClaimed(claimed);
      }
    } catch (error) {
      console.error('Error checking claim status:', error);
    } finally {
      setIsCheckingClaimStatus(false);
    }
  }, [address]);

  const checkClaimableAmount = useCallback(async () => {
    if (!address) return;

    setIsCheckingClaimable(true);
    try {
      const client = createThirdwebClient({
        clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "your-client-id"
      });

      const buyContract = getContract({
        client,
        address: BUY_CONTRACT_ADDRESS,
        chain: BSC_CHAIN,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: buy_ABI as any,
      });

      const claimable = await readContract({
        contract: buyContract,
        method: "claimable",
        params: [address],
      }) as bigint;

      setClaimableAmount(claimable);
    } catch (err) {
      console.error('Error checking claimable amount:', err);
      setClaimableAmount(null);
    } finally {
      setIsCheckingClaimable(false);
    }
  }, [address]);

  const checkOnChainClaimStatus = useCallback(async () => {
    if (!address) return null;

    try {
      const client = createThirdwebClient({
        clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "your-client-id"
      });

      const buyContract = getContract({
        client,
        address: BUY_CONTRACT_ADDRESS,
        chain: BSC_CHAIN,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: buy_ABI as any,
      });

      // Check claimable amount and balance
      const [claimable, balance] = await Promise.all([
        readContract({
          contract: buyContract,
          method: "claimable",
          params: [address],
        }) as Promise<bigint>,
        readContract({
          contract: buyContract,
          method: "balanceOf",
          params: [address],
        }) as Promise<bigint>,
      ]);

      const hasClaimedOnChain = claimable === BigInt(0) && balance > BigInt(0);
      const isUncertain = claimable === BigInt(0) && balance === BigInt(0);

      if (hasClaimedOnChain) {
        try {
          const dbResponse = await fetch(`/api/users?address=${address}`);
          if (dbResponse.status === 200) {
            const dbData = await dbResponse.json();
            const dbHasClaimed = dbData.success && dbData.data?.hasClaimed === true;

            if (!dbHasClaimed) {

              const syncResponse = await fetch('/api/users', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  address: address,
                  action: 'sync-claim-status',
                  onChainClaimed: true,
                }),
              });

              const syncData = await syncResponse.json();

              if (syncData.success) {
                setHasClaimed(true);
                setAllocationClaimed(true);
                return true;
              } else {
                console.error('Failed to update database:', syncData.error);
                return false;
              }
            } else {
              return true;
            }
          } else if (dbResponse.status === 404) {

            const syncResponse = await fetch('/api/users', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                address: address,
                action: 'sync-claim-status',
                onChainClaimed: true,
              }),
            });

            const syncData = await syncResponse.json();

            if (syncData.success) {
              setHasClaimed(true);
              setAllocationClaimed(true);
              return true;
            } else {
              console.error('Failed to create user record:', syncData.error);
              return false;
            }
          }
        } catch (dbError) {
          console.error('Error checking/updating database:', dbError);
          return false;
        }
      } else if (!isUncertain) {
        return false;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error checking on-chain claim status:', error);
      return null;
    }
  }, [address]);

  const checkBadgeBalance = useCallback(async (forceHasClaimed?: boolean) => {
    if (!address) return;

    setIsCheckingBadge(true);
    try {
      // First, fetch fresh claim status from backend to avoid race conditions
      let currentHasClaimed = false;
      if (forceHasClaimed !== undefined) {
        currentHasClaimed = forceHasClaimed;
        setHasClaimed(forceHasClaimed);
        setAllocationClaimed(forceHasClaimed);
      } else {
        try {
          const apiUrl = `/api/users?address=${address}`;
          const response = await fetch(apiUrl);

          if (response.status === 200) {
            const data = await response.json();

            if (data.success && data.data) {
              currentHasClaimed = data.data.hasClaimed || false;
              setHasClaimed(currentHasClaimed);
              setAllocationClaimed(currentHasClaimed);
            }
          } else if (response.status === 404) {
            currentHasClaimed = false;
            setHasClaimed(false);
            setAllocationClaimed(false);
          }
        } catch (error) {
          console.error('Error fetching claim status:', error);
          currentHasClaimed = hasClaimed;
        }
      }

      const client = createThirdwebClient({
        clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "your-client-id"
      });

      const badgeContract = getContract({
        client,
        address: AIRDROP_BADGE_CONTRACT,
        chain: BSC_CHAIN,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: AIRDROP_BADGE_ABI as any,
      });

      // Check badge balance
      const balance = await readContract({
        contract: badgeContract,
        method: "balanceOf",
        params: [address, AIRDROP_BADGE_ID],
      }) as bigint;

      setBadgeBalance(balance);
      const hasBadge = balance > BigInt(0);

      // Check badge config
      const config = await readContract({
        contract: badgeContract,
        method: "getBadgeConfig",
        params: [AIRDROP_BADGE_ID],
      }) as {
        claimOpen: boolean;
        redeemOpen: boolean;
        claimPrice: bigint;
      };

      const isPaused = await readContract({
        contract: badgeContract,
        method: "paused",
        params: [],
      }) as boolean;

      setBadgeConfig({
        claimOpen: config.claimOpen,
        redeemOpen: config.redeemOpen,
        claimPrice: config.claimPrice,
        paused: isPaused,
      });

      setBadgeClaimed(hasBadge);
      setAllocationClaimed(currentHasClaimed);
      const isRedeemed = !hasBadge && currentHasClaimed;
      setBadgeRedeemed(isRedeemed);
      // If badge is redeemed, show success state
      if (isRedeemed) {
        setClaimSuccess(true);
      }
    } catch (error) {
      console.error('Error checking badge balance:', error);
    } finally {
      setIsCheckingBadge(false);
    }
  }, [address, hasClaimed]);

  const handleClaimBadge = async () => {

    if (!address || !account) {
      const errorMsg = 'Please connect your wallet first';
      setError(errorMsg);
      toast.error('Wallet Not Connected', {
        description: errorMsg,
      });
      return;
    }

    if (!discordVerified) {
      const errorMsg = 'Please verify your Discord membership first';
      setError(errorMsg);
      toast.error('Discord Verification Required', {
        description: 'You need to join our Discord server and verify your membership to claim your badge.',
      });
      return;
    }

    if (!twitterVisited) {
      const errorMsg = 'Please follow us on X (Twitter) first';
      setError(errorMsg);
      toast.error('X (Twitter) Follow Required', {
        description: 'You need to follow our X (Twitter) account to claim your badge.',
      });
      return;
    }

    if (!isWhitelisted) {
      const errorMsg = 'You are not whitelisted for this airdrop';
      setError(errorMsg);
      toast.error('Not Whitelisted', {
        description: 'Your wallet address is not on the whitelist. Please contact support if you believe this is an error.',
      });
      return;
    }

    if (badgeBalance > BigInt(0)) {
      const errorMsg = 'You already have a badge';
      setError(errorMsg);
      setBadgeClaimed(true);
      setCurrentStage('allocation');
      toast.info('Badge Already Claimed', {
        description: 'You already have a badge. Proceed to claim your allocation.',
      });
      return;
    }

    if (!badgeConfig) {
      const errorMsg = 'Unable to check badge availability. Please try again.';
      setError(errorMsg);
      toast.error('Configuration Error', {
        description: 'Unable to load badge configuration. Please refresh the page and try again.',
      });
      return;
    }

    if (badgeConfig.paused) {
      const errorMsg = 'Badge claiming is currently paused';
      setError(errorMsg);
      toast.error('Claiming Paused', {
        description: 'Badge claiming is temporarily paused. Please try again later.',
      });
      return;
    }

    if (!badgeConfig.claimOpen) {
      const errorMsg = 'Badge claiming is not open yet';
      setError(errorMsg);
      toast.error('Not Available Yet', {
        description: 'Badge claiming has not started yet. Please check back later.',
      });
      return;
    }

    setIsClaimingBadge(true);
    setError(null);

    try {
      const client = createThirdwebClient({
        clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "your-client-id"
      });

      const currentChainId = activeChain?.id;
      const BSC_CHAIN_ID = 56;

      if (currentChainId !== BSC_CHAIN_ID) {
        try {
          await switchChain(BSC_CHAIN);
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch {
          const errorMsg = 'Please switch to Binance Smart Chain (BSC) in your wallet to continue.';
          setError(errorMsg);
          toast.error('Wrong Network', {
            description: errorMsg,
          });
          setIsClaimingBadge(false);
          return;
        }
      }

      const badgeContract = getContract({
        client,
        address: AIRDROP_BADGE_CONTRACT,
        chain: BSC_CHAIN,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: AIRDROP_BADGE_ABI as any,
      });

      const transaction = prepareContractCall({
        contract: badgeContract,
        method: "claim",
        params: [AIRDROP_BADGE_ID, BigInt(1), []],
        value: badgeConfig.claimPrice > BigInt(0) ? badgeConfig.claimPrice : BigInt(0),
      });

      await sendTransaction({
        transaction,
        account,
      });

      await new Promise(resolve => setTimeout(resolve, 5000));
      await checkBadgeBalance();

      setBadgeClaimed(true);
      setCurrentStage('allocation');
      setError(null);

      toast.success('Badge claimed successfully!', {
        description: 'You can now proceed to claim your allocation',
      });
    } catch (err) {
      console.error('Error claiming badge:', err);
      let errorMessage = 'Failed to claim badge';
      if (err instanceof Error) {
        const errorString = err.message;

        if (errorString.includes('user rejected') || errorString.includes('User rejected')) {
          errorMessage = 'Transaction was rejected. Please try again.';
        } else if (errorString.includes('insufficient funds') || errorString.includes('insufficient balance')) {
          errorMessage = 'Insufficient funds. Please ensure you have enough BNB for gas fees.';
        } else if (errorString.includes('BadgeAlreadyClaimed') || errorString.includes('already claimed')) {
          errorMessage = 'You have already claimed a badge.';
        } else if (errorString.includes('NotWhitelisted') || errorString.includes('not whitelisted')) {
          errorMessage = 'You are not whitelisted for this airdrop.';
        } else {
          errorMessage = 'Failed to claim badge. Please try again.';
        }
      }
      setError(errorMessage);
      toast.error('Badge Claim Failed', {
        description: errorMessage,
      });
    } finally {
      setIsClaimingBadge(false);
    }
  };

  // Step 2: Claim Allocation (updated to require badge)
  const handleClaimAllocation = async () => {
    if (!address || !account) {
      const errorMsg = 'Please connect your wallet first';
      setError(errorMsg);
      toast.error('Wallet Not Connected', {
        description: errorMsg,
      });
      return;
    }

    // Check prerequisites
    // Apply cascading logic: if user has badge/allocation, social verification must be done
    // This handles cases where state hasn't loaded yet but user has already completed verification
    const effectiveDiscordVerified = discordVerified || badgeClaimed || badgeBalance > BigInt(0) || allocationClaimed || hasClaimed;
    const effectiveTwitterVisited = twitterVisited || badgeClaimed || badgeBalance > BigInt(0) || allocationClaimed || hasClaimed;
    
    if (!effectiveDiscordVerified || !effectiveTwitterVisited) {
      const errorMsg = 'Please complete social verification first';
      setError(errorMsg);
      toast.error('Verification Required', {
        description: errorMsg,
      });
      return;
    }

    if (!isWhitelisted) {
      const errorMsg = 'You are not whitelisted for this airdrop';
      setError(errorMsg);
      toast.error('Not Whitelisted', {
        description: errorMsg,
      });
      return;
    }

    // Check if user has badge
    if (badgeBalance === BigInt(0)) {
      const errorMsg = 'You must claim a badge first';
      setError(errorMsg);
      setCurrentStage('badge');
      toast.error('Badge Required', {
        description: errorMsg,
      });
      return;
    }

    // Check if user already claimed
    if (hasClaimed) {
      const errorMsg = 'You have already claimed your allocation. Only one claim per wallet is allowed.';
      setError(errorMsg);
      toast.info('Already Claimed', {
        description: errorMsg,
      });
      return;
    }

    // Check if user has an allocation
    if (!claimableAmount || claimableAmount === BigInt(0)) {
      const errorMsg = 'You do not have an allocation to claim. Please contact support if you believe this is an error.';
      setError(errorMsg);
      toast.error('No Allocation', {
        description: errorMsg,
      });
      return;
    }

    setIsClaiming(true);
    setError(null);

    // Track claim_started event (non-blocking)
    try {
      await fetch('/api/early-circle/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'claim_started',
          walletAddress: address,
          source: 'web',
        }),
      });
    } catch (error) {
      console.error('Error tracking claim_started:', error);
    }

    try {
      const client = createThirdwebClient({
        clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "your-client-id"
      });

      const currentChainId = activeChain?.id;
      const BSC_CHAIN_ID = 56;

      if (currentChainId !== BSC_CHAIN_ID) {
        try {
          await switchChain(BSC_CHAIN);
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch {
          const errorMsg = 'Please switch to Binance Smart Chain (BSC) in your wallet to continue.';
          setError(errorMsg);
          toast.error('Wrong Network', {
            description: errorMsg,
          });
          setIsClaiming(false);
          return;
        }
      }

      const buyContract = getContract({
        client,
        address: BUY_CONTRACT_ADDRESS,
        chain: BSC_CHAIN,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: buy_ABI as any,
      });

      const isPaused = await readContract({
        contract: buyContract,
        method: "paused",
        params: [],
      });

      if (isPaused) {
        const errorMsg = 'Contract is currently paused. Please try again later.';
        setError(errorMsg);
        toast.error('Contract Paused', {
          description: errorMsg,
        });
        setIsClaiming(false);
        return;
      }

      const transaction = prepareContractCall({
        contract: buyContract,
        method: "claimAllocated",
        params: [],
      });

      await sendTransaction({
        transaction,
        account,
      });

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: address,
          action: 'claim'
        }),
      });

      const data = await response.json();

      if (data.success) {
        setHasClaimed(true);
        setAllocationClaimed(true);
        setError(null);
        setCurrentStage('redeem');

        await checkClaimStatus();
        await checkClaimableAmount();
        await checkBadgeBalance(true);
        await checkOnChainClaimStatus();

        toast.success('Allocation claimed successfully!', {
          description: 'You can now proceed to redeem your badge',
        });
      } else {
        console.error('Database update failed:', data.error);
        const onChainSynced = await checkOnChainClaimStatus();
        if (onChainSynced) {
          setHasClaimed(true);
          setAllocationClaimed(true);
          setError(null);
          setCurrentStage('redeem');
          await checkBadgeBalance(true);
          toast.success('Allocation claimed successfully!', {
            description: 'You can now proceed to redeem your badge',
          });
        } else {
          const errorMsg = data.error || 'Failed to update claim status. Please refresh the page.';
          setError(errorMsg);
          toast.error('Update Failed', {
            description: errorMsg,
          });
        }
      }
    } catch (err) {
      console.error('Error claiming allocation:', err);

      let errorMessage = 'Failed to claim allocation';
      let reasonCode = 'UNKNOWN';
      if (err instanceof Error) {
        const errorString = err.message;

        if (errorString.includes('user rejected') || errorString.includes('User rejected')) {
          errorMessage = 'Transaction was rejected. Please try again.';
          reasonCode = 'USER_REJECTED';
        } else if (errorString.includes('insufficient funds') || errorString.includes('insufficient balance')) {
          errorMessage = 'Insufficient funds. Please ensure you have enough BNB for gas fees.';
          reasonCode = 'INSUFFICIENT_FUNDS';
        } else if (errorString.includes('NoAllocation')) {
          errorMessage = 'You do not have an allocation to claim. Please contact support if you believe this is an error.';
          reasonCode = 'CONTRACT_REVERT';
        } else if (errorString.includes('NoBadge')) {
          errorMessage = 'You need to have a badge to claim. Please ensure you have the required badge.';
          reasonCode = 'CONTRACT_REVERT';
        } else if (errorString.includes('BadgeRequiredForPurchase')) {
          errorMessage = 'A badge is required for this operation. Please ensure you have the required badge.';
          reasonCode = 'CONTRACT_REVERT';
        } else if (errorString.includes('AlreadyClaimed') || errorString.includes('already claimed')) {
          errorMessage = 'You have already claimed your allocation. Only one claim per wallet is allowed.';
          reasonCode = 'CONTRACT_REVERT';
        } else if (errorString.includes('network') || errorString.includes('fetch') || errorString.includes('connection')) {
          errorMessage = 'Network error occurred. Please check your connection and try again.';
          reasonCode = 'NETWORK_ERROR';
        } else if (errorString.includes('revert') || errorString.includes('execution reverted')) {
          errorMessage = 'Transaction failed. Please check your eligibility and try again.';
          reasonCode = 'CONTRACT_REVERT';
        } else {
          errorMessage = 'Failed to claim allocation. Please try again.';
          reasonCode = 'UNKNOWN';
        }
      }

      // Track Early Circle claim_failed event (non-blocking)
      if (address) {
        try {
          await fetch('/api/early-circle/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventType: 'claim_failed',
              walletAddress: address,
              source: 'web',
              metadata: {
                reasonCode,
                rawError: err instanceof Error ? err.message : String(err),
              },
            }),
          });
        } catch (error) {
          console.error('Error tracking claim_failed:', error);
        }
      }

      setError(errorMessage);
      toast.error('Claim Failed', {
        description: errorMessage,
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const handleRedeemBadge = async () => {
    if (!address || !account) {
      const errorMsg = 'Please connect your wallet first';
      setError(errorMsg);
      toast.error('Wallet Not Connected', {
        description: errorMsg,
      });
      return;
    }

    // Check prerequisites
    // Apply cascading logic: if user has badge/allocation, social verification must be done
    // This handles cases where state hasn't loaded yet but user has already completed verification
    const effectiveDiscordVerified = discordVerified || badgeClaimed || badgeBalance > BigInt(0) || allocationClaimed || hasClaimed;
    const effectiveTwitterVisited = twitterVisited || badgeClaimed || badgeBalance > BigInt(0) || allocationClaimed || hasClaimed;
    
    if (!effectiveDiscordVerified || !effectiveTwitterVisited) {
      const errorMsg = 'Please complete social verification first';
      setError(errorMsg);
      toast.error('Verification Required', {
        description: errorMsg,
      });
      return;
    }

    if (!isWhitelisted) {
      const errorMsg = 'You are not whitelisted for this airdrop';
      setError(errorMsg);
      toast.error('Not Whitelisted', {
        description: errorMsg,
      });
      return;
    }

    // Check if user has badge
    if (badgeBalance === BigInt(0)) {
      const errorMsg = 'You do not have a badge to redeem';
      setError(errorMsg);
      setCurrentStage('badge');
      toast.error('No Badge', {
        description: errorMsg,
      });
      return;
    }

    // Check if already redeemed (balance should be 0 after redeem)
    if (badgeRedeemed) {
      const errorMsg = 'You have already redeemed your badge';
      setError(errorMsg);
      toast.info('Already Redeemed', {
        description: errorMsg,
      });
      return;
    }

    // Check badge config
    if (!badgeConfig) {
      const errorMsg = 'Unable to check badge availability. Please try again.';
      setError(errorMsg);
      toast.error('Configuration Error', {
        description: errorMsg,
      });
      return;
    }

    if (badgeConfig.paused) {
      const errorMsg = 'Badge redemption is currently paused';
      setError(errorMsg);
      toast.error('Redemption Paused', {
        description: errorMsg,
      });
      return;
    }

    if (!badgeConfig.redeemOpen) {
      const errorMsg = 'Badge redemption is not open yet';
      setError(errorMsg);
      toast.error('Not Available Yet', {
        description: errorMsg,
      });
      return;
    }

    setIsRedeemingBadge(true);
    setError(null);

    try {
      const client = createThirdwebClient({
        clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "your-client-id"
      });

      const currentChainId = activeChain?.id;
      const BSC_CHAIN_ID = 56;

      if (currentChainId !== BSC_CHAIN_ID) {
        try {
          await switchChain(BSC_CHAIN);
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch {
          const errorMsg = 'Please switch to Binance Smart Chain (BSC) in your wallet to continue.';
          setError(errorMsg);
          toast.error('Wrong Network', {
            description: errorMsg,
          });
          setIsRedeemingBadge(false);
          return;
        }
      }

      const badgeContract = getContract({
        client,
        address: AIRDROP_BADGE_CONTRACT,
        chain: BSC_CHAIN,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: AIRDROP_BADGE_ABI as any,
      });

      const transaction = prepareContractCall({
        contract: badgeContract,
        method: "redeem",
        params: [AIRDROP_BADGE_ID, BigInt(1)],
      });

      await sendTransaction({
        transaction,
        account,
      });

      await new Promise(resolve => setTimeout(resolve, 5000));
      await checkBadgeBalance();

      setBadgeRedeemed(true);
      setClaimSuccess(true);

      toast.success('Badge redeemed successfully!', {
        description: 'All steps completed!',
      });
    } catch (err) {
      console.error('Error redeeming badge:', err);
      let errorMessage = 'Failed to redeem badge';
      if (err instanceof Error) {
        const errorString = err.message;

        if (errorString.includes('user rejected') || errorString.includes('User rejected')) {
          errorMessage = 'Transaction was rejected. Please try again.';
        } else if (errorString.includes('insufficient funds') || errorString.includes('insufficient balance')) {
          errorMessage = 'Insufficient funds. Please ensure you have enough BNB for gas fees.';
        } else if (errorString.includes('AlreadyRedeemed') || errorString.includes('already redeemed')) {
          errorMessage = 'You have already redeemed your badge.';
        } else if (errorString.includes('NoBadge') || errorString.includes('no badge')) {
          errorMessage = 'You do not have a badge to redeem.';
        } else {
          errorMessage = 'Failed to redeem badge. Please try again.';
        }
      }
      setError(errorMessage);
      toast.error('Badge Redemption Failed', {
        description: errorMessage,
      });
    } finally {
      setIsRedeemingBadge(false);
    }
  };

  const handleSocialVerificationChange = useCallback((discord: boolean, twitter: boolean) => {
    setDiscordVerified(discord);
    setTwitterVisited(twitter);

    // Update step completion
    if (discord && twitter) {
      setSocialsVerified(true);
      // Move to next step if we're on verify step
      if (currentStage === 'verify') {
        setCurrentStage('badge');
      }
    }
  }, [currentStage]);

  useEffect(() => {
    if (!address) return;

    const searchParams = new URLSearchParams(window.location.search);
    const discordSuccess = searchParams.get('discord_success');

    if (discordSuccess === '1') {
      setCurrentStage('verify');
      setSocialsJoined(true);
      setIsLinkingDiscord(true);
      
      let attempts = 0;
      const maxAttempts = 10;
      
      const checkDiscordStatus = async () => {
        try {
          const response = await fetch(`/api/verify-discord-status?address=${address}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              const verified = data.data.verified || false;
              if (verified) {
                setDiscordVerified(true);
                setIsLinkingDiscord(false);
                const url = new URL(window.location.href);
                url.searchParams.delete('discord_success');
                url.searchParams.delete('discord_id');
                window.history.replaceState({}, '', url.toString());
                return;
              }
            }
          }
        } catch (error) {
          console.error('Error checking Discord status:', error);
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkDiscordStatus, 500);
        } else {
          setIsLinkingDiscord(false);
        }
      };

      setTimeout(checkDiscordStatus, 500);
    }
  }, [address]);

  useEffect(() => {
    if (discordVerified || twitterVisited) {
      setSocialsJoined(true);
    }
  }, [discordVerified, twitterVisited]);

  useEffect(() => {
    if (!address || !isWhitelisted) {
      setIsDeterminingStage(true);
      return;
    }

    const isStillLoading = isCheckingClaimStatus || isCheckingBadge || isCheckingWhitelist;
    
    if (isStillLoading) {
      setIsDeterminingStage(true);
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const discordSuccess = searchParams.get('discord_success');
    
    if (discordSuccess === '1' && isLinkingDiscord) {
      setIsDeterminingStage(false);
      return;
    }

    const hasJoinedSocials = discordVerified || twitterVisited || socialsJoined;
    const isSocialsVerified = discordVerified && twitterVisited;
    const hasBadge = badgeClaimed || badgeBalance > BigInt(0);
    const hasAllocation = allocationClaimed || hasClaimed;
    const hasRedeemed = badgeRedeemed;
    
    const effectiveHasJoinedSocials = hasJoinedSocials || isSocialsVerified || hasBadge || hasAllocation || hasRedeemed;
    const effectiveIsSocialsVerified = isSocialsVerified || hasBadge || hasAllocation || hasRedeemed;
    const effectiveHasBadge = hasBadge || hasAllocation || hasRedeemed;
    const effectiveHasAllocation = hasAllocation || hasRedeemed;
    
    if (!effectiveHasJoinedSocials) {
      setCurrentStage('socials');
    } else if (!effectiveIsSocialsVerified) {
      setCurrentStage('verify');
    } else if (!effectiveHasBadge) {
      setCurrentStage('badge');
    } else if (!effectiveHasAllocation) {
      setCurrentStage('allocation');
    } else if (!hasRedeemed) {
      setCurrentStage('redeem');
    } else {
      setCurrentStage('redeem');
    }

    setIsDeterminingStage(false);
  }, [address, isWhitelisted, socialsJoined, discordVerified, twitterVisited, badgeClaimed, badgeBalance, allocationClaimed, hasClaimed, badgeRedeemed, isLinkingDiscord, isCheckingClaimStatus, isCheckingBadge, isCheckingWhitelist]);

  const getStepStatus = (stepNumber: number): StepStatus => {
    const hasJoinedSocials = discordVerified || twitterVisited || socialsJoined;
    const steps = [
      { completed: hasJoinedSocials, current: currentStage === 'socials' },
      { completed: socialsVerified, current: currentStage === 'verify' },
      { completed: badgeClaimed, current: currentStage === 'badge' },
      { completed: allocationClaimed, current: currentStage === 'allocation' },
      { completed: badgeRedeemed, current: currentStage === 'redeem' },
    ];

    let effectiveCompleted = steps[stepNumber - 1].completed;
    if (!effectiveCompleted) {
      const laterSteps = steps.slice(stepNumber);
      const hasLaterStepCompleted = laterSteps.some(s => s.completed);
      if (hasLaterStepCompleted) {
        effectiveCompleted = true;
      }
    }

    const step = steps[stepNumber - 1];
    if (effectiveCompleted) return 'completed';
    if (step.current) return 'current';

    const previousStepsCompleted = steps.slice(0, stepNumber - 1).every(s => s.completed);
    return previousStepsCompleted ? 'upcoming' : 'disabled';
  };

  const stepperSteps = [
    {
      id: 1,
      title: t('step1.title'),
      description: t('step1.shortDescription') || 'Join Discord & Follow X',
      status: getStepStatus(1),
    },
    {
      id: 2,
      title: t('step2.title'),
      description: t('step2.shortDescription') || 'Complete verification',
      status: getStepStatus(2),
    },
    {
      id: 3,
      title: t('step3.title'),
      description: t('step3.shortDescription') || 'Get your airdrop badge',
      status: getStepStatus(3),
    },
    {
      id: 4,
      title: t('step4.title'),
      description: t('step4.shortDescription') || 'Claim your preGVT tokens',
      status: getStepStatus(4),
    },
    {
      id: 5,
      title: t('step5.title'),
      description: t('step5.shortDescription') || 'Complete the process',
      status: getStepStatus(5),
    },
  ];

  const handleRefreshEligibility = useCallback(async () => {
    if (!address) return;

    setIsRefreshingEligibility(true);

    try {
      await Promise.all([
        checkBadgeAvailability(),
        checkClaimStatus(),
        checkBNBBalanceForWallet(),
        checkClaimableAmount(),
        checkBadgeBalance(),
      ]);

      const synced = await checkOnChainClaimStatus();
      if (synced) {
        await checkBadgeBalance();
      }

      toast.success('Eligibility Refreshed', {
        description: 'Your eligibility status has been updated.',
      });
    } catch (error) {
      console.error('Error refreshing eligibility:', error);
      toast.error('Refresh Failed', {
        description: 'Failed to refresh eligibility. Please try again.',
      });
    } finally {
      setIsRefreshingEligibility(false);
    }
  }, [address, checkBadgeAvailability, checkClaimStatus, checkBNBBalanceForWallet, checkClaimableAmount, checkBadgeBalance, checkOnChainClaimStatus]);

  // Check claim status and allocation when component mounts or address changes
  useEffect(() => {
    if (address) {
      checkBadgeAvailability();
      checkClaimStatus();
      checkBNBBalanceForWallet();
      checkClaimableAmount();
      checkBadgeBalance();
      // Check on-chain status and sync with database
      checkOnChainClaimStatus().then((synced) => {
        if (synced) {
          // If database was synced, refresh the badge balance check
          checkBadgeBalance();
        }
      });
    }
  }, [address, checkBadgeAvailability, checkClaimStatus, checkBNBBalanceForWallet, checkClaimableAmount, checkBadgeBalance, checkOnChainClaimStatus]);

  return (
    <PageLayout showDisclaimerBanner>
      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          {/* Module 1: Top Banner (FOMO Trigger) */}
          <ClaimFOMOBanner />

          <PageHeader
            title={t('title')}
            description={t('subtitle')}
          />

          {!IS_CLAIM_ACTIVE ? (
            /* Pause Notification */
            <PageCard className="mb-6 sm:mb-8" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
              <div className="text-center space-y-4 sm:space-y-6 px-4 py-8 sm:py-12">
                <div className="flex justify-center">
                  <div className="p-4 sm:p-6 bg-amber-500/20 rounded-full border border-amber-400/30">
                    <ClockIcon className="w-12 h-12 sm:w-16 sm:h-16 text-amber-400" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-amber-300 mb-3 sm:mb-4">
                    Claim Temporarily Paused
                  </h3>
                  <p className="text-slate-200 text-base sm:text-lg mb-2">
                    Claim functionality is currently paused for maintenance.
                  </p>
                  <p className="text-slate-300 text-sm sm:text-base">
                    It will be back online shortly. Thank you for your patience.
                  </p>
                </div>
              </div>
            </PageCard>
          ) : (
            <>
              {/* Stepper Component */}
              {address && isWhitelisted && !isCheckingWhitelist && (
                <PageCard className="mb-6 sm:mb-8">
                  <ClaimStepper steps={stepperSteps} />
                </PageCard>
              )}

              {/* Module 2: Connect Wallet (First Required Step) */}
              <PageCard className="mb-6 sm:mb-8">
                {/* Wallet Not Connected State */}
                {!address && (
                  <div className="text-center space-y-4 sm:space-y-6">
                    <div className="flex justify-center">
                      <Image src="/icons/claim.svg" alt="Claim" width={60} height={60} className="sm:w-20 sm:h-20" />
                    </div>
                    <p className="text-white text-base sm:text-lg px-4">
                      {t('step1.description')}
                    </p>
                    <div className="flex justify-center">
                      <WalletConnect />
                    </div>
                    <p className="text-yellow-400 text-xs sm:text-sm px-4">
                      Gas fee required — BNB Chain
                    </p>
                  </div>
                )}

                {/* Wallet Connected - Show Detected Message */}
                {address && (
                  <div className="text-center space-y-3 sm:space-y-4 px-4 mb-4">
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircledIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                      <p className="text-green-400 font-semibold text-sm sm:text-base">
                        Wallet: {address.slice(0, 6)}…{address.slice(-4)} ✓ Connected
                      </p>
                    </div>
                    {(isCheckingWhitelist || isCheckingClaimStatus || isCheckingClaimable) && (
                      <p className="text-blue-400 text-sm sm:text-base animate-pulse">
                        Status: Checking eligibility…
                      </p>
                    )}
                  </div>
                )}

                {/* Wallet Connected but Not Whitelisted State */}
                {address && !isCheckingWhitelist && !isWhitelisted && (
                  <div className="text-center space-y-3 sm:space-y-4 px-4">
                    <div className="flex justify-center">
                      <div className="p-3 sm:p-4 bg-red-500/20 rounded-full border border-red-400/30">
                        <CrossCircledIcon className="w-8 h-8 sm:w-12 sm:h-12 text-red-400" />
                      </div>
                    </div>
                    <p className="text-red-400 text-lg sm:text-xl font-bold">
                      NOT WHITELISTED!
                    </p>
                    <p className="text-slate-300 text-sm sm:text-base">
                      Sorry, you are not whitelisted for this claim.
                    </p>
                  </div>
                )}

                {/* Loading State - Determining Step */}
                {address && isDeterminingStage && !isCheckingWhitelist && isWhitelisted && (
                  <div className="text-center space-y-4 sm:space-y-6 px-4 py-8 sm:py-12">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-blue-400 border-t-transparent"></div>
                    </div>
                    <p className="text-blue-400 text-base sm:text-lg font-medium">
                      Determining your progress...
                    </p>
                    <p className="text-slate-400 text-sm">
                      Please wait while we check your status
                    </p>
                  </div>
                )}

                {/* Step 1: Join Our Socials */}
                {address && currentStage === 'socials' && !isDeterminingStage && !isCheckingWhitelist && isWhitelisted && (
                  <div className="text-center space-y-4 sm:space-y-6 px-4">
                    <div className="flex justify-center">
                      <Image src="/icons/claim.svg" alt="Join Socials" width={60} height={60} className="sm:w-20 sm:h-20" />
                    </div>
                    <h4 className="text-2xl sm:text-3xl font-bold text-white">
                      {t('step1.fullTitle')}
                    </h4>
                    <p className="text-slate-300 text-base sm:text-lg">
                      {t('step1.description')}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
                      <a
                        href="https://discord.com/invite/mJKTyqWtKe"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setSocialsJoined(true)}
                        className="inline-flex items-center justify-center gap-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 px-6 py-3 rounded-xl text-base font-semibold hover:bg-indigo-500/30 transition-all duration-300"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.007-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                        </svg>
                        {t('step1.joinDiscord')}
                      </a>
                      <a
                        href="https://x.com/agvnexrur"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setSocialsJoined(true)}
                        className="inline-flex items-center justify-center gap-2 bg-slate-700/50 border border-slate-600/30 text-slate-300 px-6 py-3 rounded-xl text-base font-semibold hover:bg-slate-700/70 transition-all duration-300"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        {t('step1.followX')}
                      </a>
                    </div>

                    <p className="text-blue-400 text-sm mt-4">
                      {t('step1.afterJoining')}
                    </p>
                  </div>
                )}

                {/* Step 2: Verify Joining */}
                {address && currentStage === 'verify' && !isDeterminingStage && !isCheckingWhitelist && isWhitelisted && (
                  <div className="text-center space-y-4 sm:space-y-6 px-4">
                    <div className="flex justify-center">
                      <Image src="/icons/claim-congrat.svg" alt="Verify" width={60} height={60} className="sm:w-20 sm:h-20" />
                    </div>
                    <h4 className="text-2xl sm:text-3xl font-bold text-white">
                      {t('step2.title')}
                    </h4>
                    <p className="text-slate-300 text-base sm:text-lg">
                      {t('step2.description')}
                    </p>

                    {(isLinkingDiscord || isCheckingVerification) && (
                      <div className="bg-blue-500/20 border border-blue-400/30 rounded-xl p-4 mb-4">
                        <div className="flex items-center justify-center gap-3">
                          <ClockIcon className="w-5 h-5 animate-spin text-blue-300" />
                          <p className="text-blue-300 text-sm sm:text-base font-medium">
                            Checking verification status...
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 sm:p-6 mb-4">
                      <SocialVerification
                        address={address || ''}
                        onVerificationChange={handleSocialVerificationChange}
                        onCheckingChange={setIsCheckingVerification}
                      />
                    </div>

                    {(!discordVerified || !twitterVisited) && (
                      <div className="bg-amber-500/20 border border-amber-400/30 rounded-xl p-3 mb-4">
                        <p className="text-amber-300 text-sm text-center">
                          {t('completeVerifications')}
                        </p>
                      </div>
                    )}

                    {discordVerified && twitterVisited && (
                      <div className="bg-green-500/20 border border-green-400/30 rounded-xl p-3 mb-4">
                        <p className="text-green-300 text-sm text-center">
                          {t('verificationComplete')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Claim Badge */}
                {address && currentStage === 'badge' && !isDeterminingStage && !isCheckingWhitelist && isWhitelisted && !claimSuccess && !error && (
                  <div className="text-center space-y-4 sm:space-y-6 px-4">
                    <div className="flex justify-center">
                      <Image src="/icons/claim-congrat.svg" alt="Congratulations" width={60} height={60} className="sm:w-20 sm:h-20" />
                    </div>
                    <h4 className="text-2xl sm:text-3xl font-bold text-white">
                      {t('step3.title')}
                    </h4>
                    <p className="text-slate-300 text-base sm:text-lg">
                      {t('step3.description')}
                    </p>

                    <button
                      onClick={handleClaimBadge}
                      disabled={isClaimingBadge || isCheckingBadge}
                      className="w-full sm:w-auto bg-linear-to-r from-blue-500 to-blue-600 text-white px-6 sm:px-10 py-3 sm:py-4 rounded-xl text-base sm:text-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-500/25 transform hover:scale-105"
                    >
                      {isClaimingBadge ? (
                        <>
                          <ClockIcon className="w-5 h-5 inline mr-2 animate-spin" />
                          {t('claimingBadge')}
                        </>
                      ) : badgeClaimed ? (
                        <>
                          <CheckCircledIcon className="w-5 h-5 inline mr-2" />
                          {t('badgeClaimed')}
                        </>
                      ) : isCheckingBadge ? (
                        <>
                          <ClockIcon className="w-5 h-5 inline mr-2 animate-spin" />
                          {t('checking')}
                        </>
                      ) : (
                        <>
                          <RocketIcon className="w-5 h-5 inline mr-2" />
                          {t('claimBadge')}
                        </>
                      )}
                    </button>

                    {badgeConfig && badgeConfig.claimPrice > BigInt(0) && (
                      <p className="text-yellow-400 text-xs sm:text-sm">
                        {t('claimPrice', { amount: (Number(badgeConfig.claimPrice) / 1e18).toFixed(6) })}
                      </p>
                    )}

                    <button
                      onClick={handleRefreshEligibility}
                      disabled={isRefreshingEligibility}
                      className="mt-4 text-slate-400 hover:text-slate-200 text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      {isRefreshingEligibility ? (
                        <>
                          <ClockIcon className="w-4 h-4 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Check Again
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Step 4: Redeem Allocation */}
                {address && currentStage === 'allocation' && !isDeterminingStage && !isCheckingWhitelist && isWhitelisted && !claimSuccess && !error && (
                  <div className="text-center space-y-4 sm:space-y-6 px-4">
                    <div className="flex justify-center">
                      <Image src="/icons/claim-congrat.svg" alt="Congratulations" width={60} height={60} className="sm:w-20 sm:h-20" />
                    </div>
                    <h4 className="text-2xl sm:text-3xl font-bold text-white">
                      {t('step4.title')}
                    </h4>
                    <p className="text-slate-300 text-base sm:text-lg">
                      {t('step4.description')}
                    </p>

                    {claimableAmount && claimableAmount > 0 && (
                      <div className="bg-blue-500/20 border border-blue-400/30 rounded-2xl p-4 sm:p-6 mb-4">
                        <p className="text-blue-300 text-sm sm:text-base">
                          {t('yourAllocation', { amount: (Number(claimableAmount) / 1e18).toLocaleString() })}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={handleClaimAllocation}
                      disabled={isClaiming || isCheckingSupply || isCheckingClaimStatus || hasClaimed || !claimableAmount || claimableAmount === BigInt(0) || !hasMinimumBalance || isCheckingBalance || isCheckingClaimable || !!balanceError}
                      className="w-full sm:w-auto bg-linear-to-r from-blue-500 to-blue-600 text-white px-6 sm:px-10 py-3 sm:py-4 rounded-xl text-base sm:text-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-500/25 transform hover:scale-105"
                    >
                      {isClaiming ? (
                        <>
                          <ClockIcon className="w-5 h-5 inline mr-2 animate-spin" />
                          {t('claiming')}
                        </>
                      ) : hasClaimed ? (
                        <>
                          <CheckCircledIcon className="w-5 h-5 inline mr-2" />
                          {t('allocationClaimed')}
                        </>
                      ) : isCheckingSupply || isCheckingClaimStatus || isCheckingBalance || isCheckingClaimable ? (
                        <>
                          <ClockIcon className="w-5 h-5 inline mr-2 animate-spin" />
                          {t('checking')}
                        </>
                      ) : balanceError ? (
                        <>
                          <CrossCircledIcon className="w-5 h-5 inline mr-2" />
                          {t('balanceCheckFailed')}
                        </>
                      ) : !hasMinimumBalance ? (
                        <>
                          <CrossCircledIcon className="w-5 h-5 inline mr-2" />
                          {t('insufficientBnbBalance')}
                        </>
                      ) : !claimableAmount || claimableAmount === BigInt(0) ? (
                        <>
                          <CrossCircledIcon className="w-5 h-5 inline mr-2" />
                          {t('noAllocation')}
                        </>
                      ) : (
                        <>
                          <RocketIcon className="w-5 h-5 inline mr-2" />
                          {t('claimAllocation')}
                        </>
                      )}
                    </button>

                    {!hasClaimed && (
                      <div className="text-green-400 text-xs sm:text-sm">
                        {isCheckingClaimable ? (
                          <p>{t('checkingAllocation')}</p>
                        ) : claimableAmount && claimableAmount > 0 ? (
                          <p>{t('allocationAvailable', { amount: (Number(claimableAmount) / 1e18).toLocaleString() })}</p>
                        ) : (
                          <p>{t('noAllocationFound')}</p>
                        )}
                      </div>
                    )}

                    <p className="text-yellow-400 text-xs sm:text-sm">
                      {t('gasFeeRequired')}
                    </p>

                    <button
                      onClick={handleRefreshEligibility}
                      disabled={isRefreshingEligibility}
                      className="mt-4 text-slate-400 hover:text-slate-200 text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      {isRefreshingEligibility ? (
                        <>
                          <ClockIcon className="w-4 h-4 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Check Again
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Step 5: Redeem Badge */}
                {address && currentStage === 'redeem' && !isDeterminingStage && !isCheckingWhitelist && isWhitelisted && !claimSuccess && !error && (
                  <div className="text-center space-y-4 sm:space-y-6 px-4">
                    <div className="flex justify-center">
                      <Image src="/icons/claim-congrat.svg" alt="Congratulations" width={60} height={60} className="sm:w-20 sm:h-20" />
                    </div>
                    <h4 className="text-2xl sm:text-3xl font-bold text-white">
                      {t('step5.title')}
                    </h4>
                    <p className="text-slate-300 text-base sm:text-lg">
                      {t('step5.description')}
                    </p>

                    <button
                      onClick={handleRedeemBadge}
                      disabled={isRedeemingBadge || isCheckingBadge || !badgeConfig || badgeConfig.paused || !badgeConfig.redeemOpen || badgeBalance === BigInt(0) || badgeRedeemed || !(discordVerified || badgeClaimed || badgeBalance > BigInt(0) || allocationClaimed || hasClaimed) || !(twitterVisited || badgeClaimed || badgeBalance > BigInt(0) || allocationClaimed || hasClaimed)}
                      className="w-full sm:w-auto bg-linear-to-r from-purple-500 to-purple-600 text-white px-6 sm:px-10 py-3 sm:py-4 rounded-xl text-base sm:text-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-purple-500/25 transform hover:scale-105"
                    >
                      {isRedeemingBadge ? (
                        <>
                          <ClockIcon className="w-5 h-5 inline mr-2 animate-spin" />
                          {t('redeemingBadge')}
                        </>
                      ) : badgeRedeemed ? (
                        <>
                          <CheckCircledIcon className="w-5 h-5 inline mr-2" />
                          {t('badgeRedeemed')}
                        </>
                      ) : isCheckingBadge ? (
                        <>
                          <ClockIcon className="w-5 h-5 inline mr-2 animate-spin" />
                          {t('checking')}
                        </>
                      ) : (
                        <>
                          <RocketIcon className="w-5 h-5 inline mr-2" />
                          {t('redeemBadge')}
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleRefreshEligibility}
                      disabled={isRefreshingEligibility}
                      className="mt-4 text-slate-400 hover:text-slate-200 text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      {isRefreshingEligibility ? (
                        <>
                          <ClockIcon className="w-4 h-4 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Check Again
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Loading State - Checking Whitelist */}
                {address && isCheckingWhitelist && (
                  <div className="text-center space-y-4 sm:space-y-6 px-4">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-slate-400 border-t-transparent"></div>
                    </div>
                    <p className="text-slate-300 text-sm sm:text-base">
                      Checking whitelist status...
                    </p>
                  </div>
                )}

                {/* Success State */}
                {address && claimSuccess && (currentStage === 'badge' || currentStage === 'allocation' || currentStage === 'redeem') && (
                  <div className="text-center space-y-4 sm:space-y-6 px-4">
                    <div className="flex justify-center">
                      <div className="p-4 sm:p-6 bg-green-500/20 rounded-full border border-green-400/30">
                        <CheckCircledIcon className="w-12 h-12 sm:w-16 sm:h-16 text-green-400" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-2xl sm:text-3xl font-bold text-green-400 mb-2 sm:mb-3">
                        {t('congratulations')}
                      </h4>
                      <p className="text-slate-300 text-base sm:text-lg mb-4 sm:mb-6">
                        {t('claimSuccess')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Error State */}
                {address && error && (currentStage === 'badge' || currentStage === 'allocation' || currentStage === 'redeem') && (
                  <div className="text-center space-y-4 sm:space-y-6 px-4">
                    <div className="flex justify-center">
                      <div className="p-4 sm:p-6 bg-red-500/20 rounded-full border border-red-400/30">
                        <CrossCircledIcon className="w-12 h-12 sm:w-16 sm:h-16 text-red-400" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-2xl sm:text-3xl font-bold text-red-400 mb-2 sm:mb-3">
                        {t('error')}
                      </h4>
                      <p className="text-slate-300 text-sm sm:text-lg mb-4 wrap-break-word">
                        {error}
                      </p>
                      <button
                        onClick={() => {
                          setError(null);
                          setClaimSuccess(false);
                        }}
                        className="w-full sm:w-auto bg-linear-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-xl text-base sm:text-lg font-semibold hover:from-red-600 hover:to-red-700 transition-all duration-300"
                      >
                        {t('tryAgain') || 'Try Again'}
                      </button>
                    </div>
                  </div>
                )}
              </PageCard>
            </>
          )}

          {/* Module 5: Purchase Prompt (Persistent after claim) */}
          {address && hasClaimed && (
            <PageCard className="mb-6 sm:mb-8" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: 'rgba(96, 165, 250, 0.3)' }}>
              <div className="text-center space-y-4 sm:space-y-6 px-4">
                <div className="flex justify-center">
                  <RocketIcon className="w-12 h-12 sm:w-16 sm:h-16 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">
                    Step 4 — Buy Pre-Token at $0.005 (48h Price Freeze)
                  </h4>
                  <p className="text-slate-300 text-base sm:text-lg mb-4 sm:mb-6">
                    Your bonus reward unlocks only after a minimum buy of $20.
                  </p>
                  <Link
                    href="/buy"
                    className="inline-block bg-linear-to-r from-blue-500 to-blue-600 text-white px-6 sm:px-10 py-3 sm:py-4 rounded-xl text-base sm:text-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-blue-500/25 transform hover:scale-105 mb-3 sm:mb-4"
                  >
                    Buy $20 Now (Highly Recommended)
                  </Link>
                  <p className="text-blue-300 text-xs sm:text-sm">
                    Price increases after 48 hours. Early buyers get priority.
                  </p>
                </div>
              </div>
            </PageCard>
          )}

          {/* Module 6: Referral Module (After successful claim) */}
          {address && allocationClaimed && (
            <PageCard className="mb-6 sm:mb-8">
              <div className="text-center space-y-4 sm:space-y-6 px-4">
                <div className="flex justify-center">
                  <RocketIcon className="w-10 h-10 sm:w-12 sm:h-12 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">
                    Invite & Earn More Airdrop
                  </h4>
                  <p className="text-slate-300 text-base sm:text-lg mb-4 sm:mb-6">
                    Share your link — every friend who buys ≥ $20 gives you extra rewards.
                  </p>
                  {address && (
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 sm:p-6 mb-4">
                      <p className="text-slate-400 text-xs sm:text-sm mb-2">Your Referral Link:</p>
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <code className="text-blue-300 text-xs sm:text-sm wrap-break-word px-3 py-2 bg-slate-900/50 rounded">
                          {typeof window !== 'undefined' ? `${window.location.origin}/buy/wallet/${address}` : `/buy/wallet/${address}`}
                        </code>
                        <button
                          onClick={async () => {
                            try {
                              const link = typeof window !== 'undefined' ? `${window.location.origin}/buy/wallet/${address}` : `/buy/wallet/${address}`;
                              await navigator.clipboard.writeText(link);
                              toast.success('Referral link copied to clipboard!', {
                                description: 'Share this link with your friends to earn rewards',
                                duration: 3000,
                              });
                            } catch {
                              toast.error('Failed to copy link', {
                                description: 'Please try again or copy the link manually',
                                duration: 3000,
                              });
                            }
                          }}
                          className="px-4 py-2 bg-blue-500/20 border border-blue-400/30 rounded-lg text-blue-300 text-sm font-semibold hover:bg-blue-500/30 transition-colors"
                        >
                          Copy Link
                        </button>
                      </div>
                      <p className="text-slate-400 text-xs text-center">
                        Top referrers will appear on the leaderboard.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </PageCard>
          )}


          {/* Module 8: Leaderboard (FOMO Module) */}
          <PageCard className="mb-6 sm:mb-8" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }}>
            {/* Total Claimed Counter */}
            <div className="mb-6 px-4">
              <div className="text-center mb-4">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                  {t('totalClaimed')}: {isLoadingTotalClaimed ? '...' : totalClaimed.toLocaleString()} / {TOTAL_SUPPLY.toLocaleString()}
                </h3>
                {/* Progress Bar */}
                <div className="w-full bg-slate-700/50 rounded-full h-4 sm:h-6 overflow-hidden">
                  <div
                    className="bg-linear-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-500 flex items-center justify-center"
                    style={{ width: `${Math.min((totalClaimed / TOTAL_SUPPLY) * 100, 100)}%` }}
                  >
                    {totalClaimed > 0 && (
                      <span className="text-xs sm:text-sm font-semibold text-white px-2">
                        {Math.round((totalClaimed / TOTAL_SUPPLY) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-slate-400 text-xs sm:text-sm mt-2">
                  {t('remainingSupply')}: {(TOTAL_SUPPLY - totalClaimed).toLocaleString()}
                </p>
              </div>
            </div>
            <Leaderboard
              leaderboard={leaderboard}
              isLoading={isLeaderboardLoading}
              type="claim-referral"
              currentAddress={address}
            />
          </PageCard>
        </div>
      </main>
    </PageLayout>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={null}>
      <DiscordErrorHandler />
      <ClaimPageContent />
    </Suspense>
  );
}

