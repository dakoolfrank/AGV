'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useSearchParams, usePathname } from 'next/navigation';
import Image from 'next/image';
import { PageLayout } from '@/components/layouts/PageLayout';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Copy, Lock } from 'lucide-react';
import { PageCard } from '@/components/ui/PageCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { BUY_CONTRACT_ADDRESS, buy_ABI } from '@/lib/contracts';
import { getContract, prepareContractCall, sendTransaction, readContract, defineChain, waitForReceipt } from 'thirdweb';
import { createThirdwebClient } from 'thirdweb';
import { useActiveWalletChain, useSwitchActiveWalletChain } from 'thirdweb/react';
import { toast } from 'sonner';
import { FOMOSection } from '@/components/FOMOSection';
import { Leaderboard } from '@/components/Leaderboard';
import { Input } from '@/components/ui/input';
import { useTranslations } from '@/lib/translation-provider';
import { usePageTracking } from '@/hooks/usePageTracking';

// ERC20 ABI for approve and allowance functions
const ERC20_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" }
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

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

function BuyPageContent() {
  const { t } = useTranslations('buy');
  const account = useActiveAccount();
  const address = account?.address;
  const activeChain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  // Track page visit
  usePageTracking('buy', address);
  
  interface BuyerLeaderboardEntry {
    wallet: string;
    totalAmount: number;
    purchaseCount: number;
    rank?: number;
  }
  
  const [buyerLeaderboard, setBuyerLeaderboard] = useState<BuyerLeaderboardEntry[]>([]);
  const [isBuyerLeaderboardLoading, setIsBuyerLeaderboardLoading] = useState(false);
  
  // Fetch buyer leaderboard from new API
  const fetchBuyerLeaderboard = useCallback(async () => {
    setIsBuyerLeaderboardLoading(true);
    try {
      console.log('[CLIENT DEBUG] Fetching buyer leaderboard...');
      const response = await fetch('/api/buyer-leaderboard');
      
      console.log('[CLIENT DEBUG] Buyer leaderboard API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[CLIENT DEBUG] Buyer leaderboard API response data:', {
          success: data.success,
          leaderboardCount: data.data?.length || 0,
          debug: data.debug,
          leaderboard: data.data,
        });
        
        if (data.success && data.data) {
          setBuyerLeaderboard(data.data);
          console.log('[CLIENT DEBUG] Buyer leaderboard updated:', {
            entries: data.data.length,
            currentUserAddress: address,
            isCurrentUserInLeaderboard: address ? data.data.some((entry: BuyerLeaderboardEntry) => 
              entry.wallet.toLowerCase() === address.toLowerCase()
            ) : false,
          });
        } else {
          console.warn('[CLIENT DEBUG] Buyer leaderboard API returned success=false:', data);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[CLIENT DEBUG] Buyer leaderboard API error:', {
          status: response.status,
          error: errorData,
        });
      }
    } catch (error) {
      console.error('[CLIENT DEBUG] Failed to fetch buyer leaderboard:', error);
    } finally {
      setIsBuyerLeaderboardLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchBuyerLeaderboard();
    // Refresh every 60 seconds
    const interval = setInterval(fetchBuyerLeaderboard, 60000);
    return () => clearInterval(interval);
  }, [fetchBuyerLeaderboard]);

  // KOL Referral
  const [kolDigits, setKolDigits] = useState("");
  const [kolLocked, setKolLocked] = useState(false);
  const fullKolId = useMemo(() => (kolDigits && kolDigits.length === 6 ? `AGV-KOL${kolDigits}` : ""), [kolDigits]);

  // Wallet Referral (for claimers)
  const [referrerWallet, setReferrerWallet] = useState<string | null>(null);
  const [walletReferralLocked, setWalletReferralLocked] = useState(false);

  // Extract referral ID from URL (handles both KOL and wallet referrals)
  useEffect(() => {
    // Priority 1: Check pathname patterns first
    if (pathname) {
      // Check for /buy/wallet/{address} pattern
      const walletMatch = pathname.match(/\/buy\/wallet\/(0x[a-fA-F0-9]{40})/);
      if (walletMatch) {
        const walletAddress = walletMatch[1];
        setReferrerWallet(walletAddress.toLowerCase());
        setWalletReferralLocked(true);
        setKolDigits(""); // Clear KOL if wallet referral is found
        return;
      }

      // Check for /buy/kol/{kolId} pattern
      const kolPathMatch = pathname.match(/\/buy\/kol\/(\d{6})/);
      if (kolPathMatch) {
        const digits = kolPathMatch[1];
        setKolDigits(digits);
        setKolLocked(true);
        setReferrerWallet(null); // Clear wallet if KOL referral is found
        return;
      }

      // Legacy: Check for /buy/{kolId} pattern (6 digits)
      const legacyMatch = pathname.match(/\/buy\/(\d{6})(?:$|[/?#])/);
      if (legacyMatch) {
        const digits = legacyMatch[1];
        setKolDigits(digits);
        setKolLocked(true);
        setReferrerWallet(null);
        return;
      }
    }

    // Priority 2: Check query parameters
    const kolIdParam = searchParams?.get("kolId");
    const refParam = searchParams?.get("ref");

    if (kolIdParam) {
      // KOL referral from query param
      const digits = (kolIdParam.match(/\d{6}/) || [])[0] || "";
      if (digits) {
        setKolDigits(digits);
        setKolLocked(true);
        setReferrerWallet(null);
      }
    } else if (refParam) {
      // Check if ref is a wallet address (starts with 0x and 42 chars) or KOL ID (6 digits)
      if (refParam.startsWith('0x') && refParam.length === 42) {
        // Wallet referral
        setReferrerWallet(refParam.toLowerCase());
        setWalletReferralLocked(true);
        setKolDigits("");
      } else {
        // KOL referral (6 digits)
        const digits = (refParam.match(/\d{6}/) || [])[0] || "";
        if (digits) {
          setKolDigits(digits);
          setKolLocked(true);
          setReferrerWallet(null);
        }
      }
    }
  }, [searchParams, pathname]);

  const [buyAmount, setBuyAmount] = useState<string>('');
  const [showReview, setShowReview] = useState(false);
  const [pricePerToken, setPricePerToken] = useState<string>('0.005');
  const [minimumReceived, setMinimumReceived] = useState<string>('0.000567');
  const [isBuying, setIsBuying] = useState(false);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  
  // Minimum purchase amount in USD
  const MINIMUM_PURCHASE_AMOUNT = 5;

  // Load price per token from contract
  const loadPriceData = useCallback(async () => {
    if (!address || !BUY_CONTRACT_ADDRESS) {
      // Set default price if wallet is not connected or contract address is not set
      setPricePerToken('0.005');
      return;
    }

    setIsLoadingPrice(true);
    try {
      const client = createThirdwebClient({
        clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "your-client-id"
      });

      // Try multiple RPC endpoints for better reliability (same as claim page)
      const rpcEndpoints = [
        "https://bsc-dataseed.binance.org/",
        "https://bsc-dataseed1.defibit.io/",
        "https://bsc-dataseed1.ninicoin.io/",
        "https://bsc-dataseed2.defibit.io/"
      ];
      
      let contract = null;
      let workingRpc = null;
      
      for (const rpc of rpcEndpoints) {
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
        // Set default price if all RPCs failed
        setPricePerToken('0.005');
        return;
      }

      const price = await readContract({
        contract,
        method: "pricePerToken",
        params: [],
      });
      
      // Convert from wei (assuming 18 decimals)
      // Price is stored in wei format (e.g., 0.005 USDT = 0.005 * 1e18 = 5000000000000000)
      const priceInUSDT = Number(price) / 1e18;
      setPricePerToken(priceInUSDT.toFixed(3)); // Format to 3 decimals (0.005)
    } catch (err) {
      console.error('Error loading price:', err);
      // Set default price on error
      setPricePerToken('0.005');
    } finally {
      setIsLoadingPrice(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      loadPriceData();
    }
  }, [address, loadPriceData]);

  const handleAmountSelect = (amount: number) => {
    setBuyAmount(amount.toString());
  };

  const handleReview = async () => {
    if (!buyAmount || parseFloat(buyAmount) <= 0) {
      toast.error(t('enterValidAmount'));
      return;
    }
    
    const amount = parseFloat(buyAmount);
    if (amount < MINIMUM_PURCHASE_AMOUNT) {
      toast.error(`Minimum purchase amount is $${MINIMUM_PURCHASE_AMOUNT}. Please enter a higher amount.`);
      return;
    }
    
    if (!address) {
      toast.error(t('connectWalletFirst'));
      return;
    }

    // Check for self-referral (both KOL and Wallet)
    // Priority: KOL referral takes precedence
    if (fullKolId && fullKolId.trim() && address) {
      // Check KOL self-referral
      try {
        const checkResponse = await fetch(`/api/kol/check-wallet?kolId=${encodeURIComponent(fullKolId)}&wallet=${encodeURIComponent(address)}`);
        const checkData = await checkResponse.json();
        
        if (checkData.success && checkData.isSelfReferral) {
          toast.error(t('selfReferralError', { type: 'KOL ID' }), {
            duration: 5000,
          });
          // Don't proceed to review if self-referral detected
          return;
        }
      } catch (error) {
        console.error('Error checking KOL wallet:', error);
        // Continue with review even if check fails (but backend will catch it)
      }
    } else if (referrerWallet && referrerWallet.trim() && address) {
      // Check wallet self-referral
      if (referrerWallet.toLowerCase() === address.toLowerCase()) {
        toast.error(t('selfReferralError', { type: 'wallet address' }), {
          duration: 5000,
        });
        // Don't proceed to review if self-referral detected
        return;
      }
    }

    // Calculate minimum received (example calculation)
    const tokens = amount / parseFloat(pricePerToken || '1');
    setMinimumReceived((tokens * 0.99).toFixed(6)); // 1% slippage
    
    setShowReview(true);
  };

  // Check if approval is needed and get payment token address
  const checkApproval = useCallback(async (requiredAmount: bigint): Promise<{ paymentTokenAddress: string; needsApproval: boolean }> => {
    if (!address || !BUY_CONTRACT_ADDRESS) {
      return { paymentTokenAddress: '', needsApproval: false };
    }

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

      // Get payment token address from the buy contract
      const paymentTokenAddress = await readContract({
        contract: buyContract,
        method: "paymentToken",
        params: [],
      }) as string;

      // Get ERC20 token contract
      const tokenContract = getContract({
        client,
        address: paymentTokenAddress,
        chain: BSC_CHAIN,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: ERC20_ABI as any,
      });

      // Check current allowance
      const currentAllowance = await readContract({
        contract: tokenContract,
        method: "allowance",
        params: [address, BUY_CONTRACT_ADDRESS],
      }) as bigint;

      return {
        paymentTokenAddress,
        needsApproval: currentAllowance < requiredAmount
      };
    } catch (err) {
      console.error('Error checking approval:', err);
      // If we can't check, assume approval is needed to be safe
      return { paymentTokenAddress: '', needsApproval: true };
    }
  }, [address]);

  // Approve USDT spending
  const approveToken = async (paymentTokenAddress: string, requiredAmount: bigint) => {
    if (!address || !account) {
      toast.error(t('connectWalletFirst'));
      return false;
    }

    setIsApproving(true);

    try {
      // Check if wallet is on BSC chain (chain ID 56)
      const currentChainId = activeChain?.id;
      const BSC_CHAIN_ID = 56;

      if (currentChainId !== BSC_CHAIN_ID) {
        try {
          await switchChain(BSC_CHAIN);
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch {
          toast.error(t('switchChain'));
          setIsApproving(false);
          return false;
        }
      }

      const client = createThirdwebClient({
        clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "your-client-id"
      });

      const tokenContract = getContract({
        client,
        address: paymentTokenAddress,
        chain: BSC_CHAIN,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: ERC20_ABI as any,
      });

      // Use the required amount for approval instead of max approval
      // This shows the actual purchase amount in the wallet instead of "unlimited"
      const approveTransaction = prepareContractCall({
        contract: tokenContract,
        method: "approve",
        params: [BUY_CONTRACT_ADDRESS, requiredAmount],
      });

      // Send transaction - this should automatically open MetaMask
      // The sendTransaction call must be directly triggered by user interaction
      // to avoid popup blockers, so we call it immediately without delay
      const sendPromise = sendTransaction({
        transaction: approveTransaction,
        account,
      });

      // Show toast notification while waiting for user to approve
      toast.info(t('checkWallet'), {
        duration: 4000,
      });

      // Wait for transaction to complete
      await sendPromise;

      toast.success(t('approvalSuccess'));
      return true;
    } catch (err) {
      console.error('Error approving token:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve token';
      
      if (errorMessage.includes('User rejected') || errorMessage.includes('denied') || errorMessage.includes('rejected')) {
        toast.error(t('approvalRejected'));
      } else if (errorMessage.includes('User closed') || errorMessage.includes('closed')) {
        toast.error(t('transactionClosed'));
      } else {
        toast.error(`${t('approvalFailed')}: ${errorMessage}`);
      }
      return false;
    } finally {
      setIsApproving(false);
    }
  };

  const handleBuy = async () => {
    if (!address || !account) {
      toast.error(t('connectWalletFirst'));
      return;
    }

    if (!buyAmount || parseFloat(buyAmount) <= 0) {
      toast.error(t('enterValidAmount'));
      return;
    }

    const amount = parseFloat(buyAmount);
    if (amount < MINIMUM_PURCHASE_AMOUNT) {
      toast.error(`Minimum purchase amount is $${MINIMUM_PURCHASE_AMOUNT}. Please enter a higher amount.`);
      setIsBuying(false);
      return;
    }

    setIsBuying(true);

    // Track buy_started event (non-blocking)
    try {
      await fetch('/api/early-circle/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'buy_started',
          walletAddress: address,
          source: 'web',
          metadata: {
            intendedAmount: parseFloat(buyAmount),
          },
        }),
      });
    } catch (error) {
      console.error('Error tracking buy_started:', error);
    }

    try {
      // Check if wallet is on BSC chain (chain ID 56)
      const currentChainId = activeChain?.id;
      const BSC_CHAIN_ID = 56;

      if (currentChainId !== BSC_CHAIN_ID) {
        try {
          await switchChain(BSC_CHAIN);
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch {
          toast.error(t('switchChain'));
          setIsBuying(false);
          return;
        }
      }

      const client = createThirdwebClient({
        clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "your-client-id"
      });

      // Get the contract instance with BSC chain (same pattern as claim page)
      const contract = getContract({
        client,
        address: BUY_CONTRACT_ADDRESS,
        chain: BSC_CHAIN,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: buy_ABI as any,
      });

      // Check contract state before attempting to buy (similar to claim page)
      const isPaused = await readContract({
        contract,
        method: "paused",
        params: [],
      });

      const presaleActive = await readContract({
        contract,
        method: "presaleActive",
        params: [],
      });

      if (isPaused) {
        toast.error('Contract is currently paused. Please try again later.');
        setIsBuying(false);
        return;
      }

      if (!presaleActive) {
        toast.error('Presale is not currently active. Please try again later.');
        setIsBuying(false);
        return;
      }

      // Calculate token amount (amount in USDT / price per token)
      // buyAmount is in USDT, pricePerToken is in USDT per token
      // Contract expects amount in smallest unit (multiplied by 1e18)
      const usdtAmount = parseFloat(buyAmount);
      
      // Validate purchase amount
      if (isNaN(usdtAmount) || usdtAmount <= 0) {
        toast.error('Please enter a valid purchase amount');
        setIsBuying(false);
        return;
      }
      
      console.log('[CLIENT DEBUG] Purchase amount validation:', {
        buyAmount,
        usdtAmount,
        usdtAmountType: typeof usdtAmount,
        isValid: !isNaN(usdtAmount) && usdtAmount > 0,
      });
      
      const price = parseFloat(pricePerToken || '0.005');
      
      if (price <= 0) {
        toast.error('Invalid token price. Please refresh and try again.');
        setIsBuying(false);
        return;
      }

      // Calculate token amount: usdtAmount / pricePerToken
      // Then multiply by 1e18 to convert to smallest unit (wei format)
      // The contract expects all inputs multiplied by 1e18
      const tokensToBuy = usdtAmount / price;
      
      // Multiply by 1e18 (1 with 18 zeros) to convert to wei format
      // This is required before sending to the contract
      const tokenAmount = BigInt(Math.floor(tokensToBuy * 1e18));

      if (tokenAmount <= BigInt(0)) {
        toast.error('Token amount is too small. Please enter a larger amount.');
        setIsBuying(false);
        return;
      }

      // Calculate required USDT amount (same calculation as the contract will do)
      const requiredUSDT = BigInt(Math.floor(usdtAmount * 1e18));

      // Check if approval is needed
      const { paymentTokenAddress, needsApproval: needsApprovalCheck } = await checkApproval(requiredUSDT);
      
      if (!paymentTokenAddress) {
        toast.error(t('paymentTokenError') || 'Failed to get payment token address. Please try again.');
        setIsBuying(false);
        return;
      }

      if (needsApprovalCheck) {
        setIsBuying(false);
        
        // Notify user that approval is needed and MetaMask will open
        toast.info(t('approvalRequired') || 'USDT approval required. MetaMask will open automatically...', {
          duration: 2000,
        });
        
        // Small delay to ensure UI updates and toast is visible
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const approved = await approveToken(paymentTokenAddress, requiredUSDT);
        
        if (!approved) {
          return;
        }
        
        setIsBuying(true);
        
        // Wait a moment for the approval transaction to be confirmed
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Prepare the buy call
      const transaction = prepareContractCall({
        contract,
        method: "buy",
        params: [tokenAmount],
      });

      // Send the transaction (same pattern as claim page)
      // The wallet will handle the RPC connection
      const receipt = await sendTransaction({
        transaction,
        account,
      });
      await waitForReceipt({ 
        client, 
        chain: BSC_CHAIN, 
        transactionHash: receipt.transactionHash 
      });

      toast.success(t('purchaseSuccess'), {
        description: `${t('purchaseSuccessDesc') || 'You have successfully purchased tokens.'} Transaction hash: ${receipt.transactionHash.slice(0, 10)}...`,
      });
      
      // Record referral purchase (KOL or Wallet referral)
      // Priority: KOL referral takes precedence over wallet referral
      if (address) {
        try {
          // Check for self-referral
          let isSelfReferral = false;
          let referralType = '';

          if (fullKolId && fullKolId.trim()) {
            // KOL referral
            referralType = 'kol';
            const checkResponse = await fetch(`/api/kol/check-wallet?kolId=${encodeURIComponent(fullKolId)}&wallet=${encodeURIComponent(address)}`);
            const checkData = await checkResponse.json();
            if (checkData.success && checkData.isSelfReferral) {
              isSelfReferral = true;
              toast.warning(t('selfReferralWarning') || 'You cannot refer yourself. This referral will not count towards your rewards.', {
                duration: 5000,
              });
            }
          } else if (referrerWallet && referrerWallet.trim()) {
            // Wallet referral
            referralType = 'wallet';
            if (referrerWallet.toLowerCase() === address.toLowerCase()) {
              isSelfReferral = true;
              toast.warning(t('selfReferralWarning') || 'You cannot refer yourself. This referral will not count towards your rewards.', {
                duration: 5000,
              });
            }
          }

          // Record the purchase (only if not self-referral)
          if (!isSelfReferral && (fullKolId || referrerWallet)) {
            const purchaseData = {
              address,
              action: 'record-purchase',
              purchaseAmount: usdtAmount,
              tokenAmount: tokensToBuy.toString(),
              kolId: fullKolId || undefined,
              referrerWallet: referrerWallet || undefined,
              txHash: receipt.transactionHash,
            };

            console.log('[CLIENT DEBUG] Recording purchase referral:', {
              buyerAddress: address,
              referralType: fullKolId ? 'KOL' : 'WALLET',
              kolId: fullKolId || null,
              referrerWallet: referrerWallet || null,
              purchaseAmount: usdtAmount,
              purchaseAmountType: typeof usdtAmount,
              buyAmount: buyAmount,
              tokensToBuy: tokensToBuy,
              pricePerToken: pricePerToken,
              txHash: receipt.transactionHash,
              isSelfReferral,
            });

            const recordResponse = await fetch('/api/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(purchaseData),
            });
            
            const recordData = await recordResponse.json();
            
            console.log('[CLIENT DEBUG] Purchase referral API response:', {
              success: recordData.success,
              message: recordData.message,
              error: recordData.error,
              data: recordData.data,
              status: recordResponse.status,
            });

            if (!recordData.success) {
              if (recordData.error === 'Cannot refer yourself') {
                // Toast already shown above
              } else {
                console.error('[CLIENT DEBUG] Failed to record purchase referral:', recordData.error);
                toast.error(`${t('referralNotRecorded') || 'Referral not recorded'}: ${recordData.error}`, {
                  duration: 5000,
                });
              }
            } else {
              console.log('[CLIENT DEBUG] Purchase referral recorded successfully:', {
                referralType: recordData.data?.referralType,
                referrerWallet: recordData.data?.referrerWallet,
                kolId: recordData.data?.kolId,
                fullResponse: recordData,
              });
            }
          } else {
            console.log('[CLIENT DEBUG] Skipping referral recording:', {
              isSelfReferral,
              hasKolId: !!fullKolId,
              hasReferrerWallet: !!referrerWallet,
              reason: isSelfReferral ? 'Self-referral detected' : 'No referral ID',
            });
          }
        } catch (error) {
          console.error('Error recording referral purchase:', error);
          // Don't show error to user - purchase was successful
        }
      }

      setShowReview(false);
      setBuyAmount('');
    } catch (err) {
      console.error('Error buying tokens:', err);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to buy tokens';
      let reasonCode = 'UNKNOWN';
      if (err instanceof Error) {
        const errorString = err.message;
        
        if (errorString.includes('Failed to fetch') || errorString.includes('ERR_NAME_NOT_RESOLVED')) {
          errorMessage = 'Unable to connect to BSC network. Please check your internet connection and try again.';
          reasonCode = 'NETWORK_ERROR';
        } else if (errorString.includes('User rejected') || errorString.includes('denied') || errorString.includes('user rejected')) {
          errorMessage = 'Transaction was rejected. Please approve the transaction in your wallet.';
          reasonCode = 'USER_REJECTED';
        } else if (errorString.includes('insufficient funds') || errorString.includes('balance')) {
          errorMessage = 'Insufficient balance. Please ensure you have enough USDT and BNB for gas fees.';
          reasonCode = 'INSUFFICIENT_FUNDS';
        } else if (errorString.includes('allowance') || errorString.includes('approval')) {
          errorMessage = 'Token approval required. Please try again - the approval step should happen automatically.';
          reasonCode = 'INSUFFICIENT_ALLOWANCE';
        } else if (errorString.includes('PresaleNotActive') || errorString.includes('presale not active')) {
          errorMessage = 'Presale is not currently active. Please try again later.';
          reasonCode = 'PRESALE_NOT_ACTIVE';
        } else if (errorString.includes('Paused') || errorString.includes('paused')) {
          errorMessage = 'Contract is currently paused. Please try again later.';
          reasonCode = 'CONTRACT_PAUSED';
        } else if (errorString.includes('revert') || errorString.includes('execution reverted')) {
          errorMessage = 'Transaction failed. Please check your eligibility and try again.';
          reasonCode = 'CONTRACT_REVERT';
        } else {
          errorMessage = 'Failed to buy tokens. Please try again.';
          reasonCode = 'UNKNOWN';
        }
      }
      
      // Track Early Circle buy_failed event (non-blocking)
      if (address) {
        try {
          await fetch('/api/early-circle/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventType: 'buy_failed',
              walletAddress: address,
              source: 'web',
              metadata: {
                reasonCode,
                rawError: err instanceof Error ? err.message : String(err),
                intendedAmount: buyAmount ? parseFloat(buyAmount) : undefined,
              },
            }),
          });
        } catch (error) {
          console.error('Error tracking buy_failed:', error);
        }
      }
      
      toast.error(t('purchaseFailed'), {
        description: errorMessage,
      });
    } finally {
      setIsBuying(false);
    }
  };

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleCopyReferralLink = () => {
    if (referrerWallet) {
      const link = `${window.location.origin}/buy/wallet/${referrerWallet}`;
      navigator.clipboard.writeText(link);
      toast.success('Wallet referral link copied to clipboard!');
    } else if (kolDigits) {
      const link = `${window.location.origin}/buy/${kolDigits}`;
      navigator.clipboard.writeText(link);
      toast.success('KOL referral link copied to clipboard!');
    } else {
      toast.error('No referral ID to copy');
    }
  };

  // Get display value for referral ID field
  const getReferralDisplayValue = () => {
    if (referrerWallet) {
      return referrerWallet;
    } else if (fullKolId) {
      return fullKolId;
    } else if (kolDigits) {
      return kolDigits;
    }
    return '';
  };

  // Check if referral is locked
  const isReferralLocked = kolLocked || walletReferralLocked;

  return (
    <PageLayout showStickyDisclaimer>
      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <PageHeader 
            title={t('title')}
            description={t('subtitle')}
          />

          {/* Limited Supply Section */}
          <div className="mb-8 sm:mb-12">
            <FOMOSection />
          </div>

          {/* Buy Container */}
          {!showReview ? (
            <>
              <PageCard className="mb-6">
                {/* Buy/USDT Selector */}
                <div className="flex justify-between items-center mb-4 sm:mb-6 gap-2 sm:gap-0">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 sm:px-6 py-2 sm:py-3 border border-white/20">
                    <span className="text-white text-sm sm:text-lg font-semibold">{t('buy') || 'Buy'}</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 sm:px-6 py-2 sm:py-3 border border-white/20 flex items-center gap-2">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 p-1 sm:p-2 bg-green-400 rounded-full flex items-center justify-center overflow-hidden">
                      <Image src="/usdt.png" alt="USDT" width={32} height={32} className="w-full h-full object-contain" />
                    </div>
                    <span className="text-white text-sm sm:text-lg font-semibold">{t('usdt') || 'USDT'}</span>
                    
                  </div>
                </div>

                {/* Referral ID Section */}
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 border border-white/20">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base sm:text-lg font-semibold text-white">
                      {t('referralId')} {isReferralLocked ? `(${t('locked') || 'Locked'})` : `(${t('optional')})`}
                    </h3>
                    {(referrerWallet || kolDigits) && (
                      <Button
                        onClick={handleCopyReferralLink}
                        variant="outline"
                        size="sm"
                        className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        {t('copyLink') || 'Copy Link'}
                      </Button>
                    )}
                  </div>
                  <Input
                    type="text"
                    value={getReferralDisplayValue()}
                    onChange={(e) => {
                      // Only allow editing if not locked
                      if (!isReferralLocked) {
                        const value = e.target.value;
                        // Check if it's a wallet address (starts with 0x)
                        if (value.startsWith('0x')) {
                          // Allow wallet address input
                          if (value.length <= 42) {
                            const walletLower = value.toLowerCase();
                            setReferrerWallet(walletLower);
                            setKolDigits('');
                            setKolLocked(false);
                            
                            // Check for self-referral immediately
                            if (address && walletLower === address.toLowerCase()) {
                              toast.error(t('selfReferralError', { type: 'wallet address' }), {
                                duration: 4000,
                              });
                              // Clear the input
                              setReferrerWallet(null);
                            }
                          }
                        } else {
                          // KOL ID input (digits only)
                          const digits = value.replace(/\D/g, '').slice(0, 6);
                          setKolDigits(digits);
                          // Clear wallet referral if user manually enters KOL ID
                          if (digits) {
                            setReferrerWallet(null);
                            setWalletReferralLocked(false);
                            
                            // Check for self-referral when 6 digits are entered
                            if (digits.length === 6 && address) {
                              const checkSelfReferral = async () => {
                                try {
                                  const fullId = `AGV-KOL${digits}`;
                                  const checkResponse = await fetch(`/api/kol/check-wallet?kolId=${encodeURIComponent(fullId)}&wallet=${encodeURIComponent(address)}`);
                                  const checkData = await checkResponse.json();
                                  
                                  if (checkData.success && checkData.isSelfReferral) {
                                    toast.error(t('selfReferralError', { type: 'KOL ID' }), {
                                      duration: 4000,
                                    });
                                    // Clear the input
                                    setKolDigits('');
                                  }
                                } catch (error) {
                                  // Silently fail - will be checked again in handleReview
                                }
                              };
                              checkSelfReferral();
                            }
                          }
                        }
                      }
                    }}
                    placeholder={referrerWallet ? t('walletAddress') || "Wallet Address" : t('enterReferralId') || "Enter 6-digit referral ID or wallet address"}
                    disabled={isReferralLocked}
                    readOnly={isReferralLocked}
                    className="w-full text-center text-sm sm:text-lg font-mono tracking-wider bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  />
                  {isReferralLocked && (
                    <p className="text-xs text-white/70 mt-2 flex items-center justify-center gap-1">
                      <Lock className="h-3 w-3" />
                      {referrerWallet ? t('lockedWalletReferral') || 'Locked: Wallet referral detected' : t('lockedKolReferral') || 'Locked: KOL referral detected'}
                    </p>
                  )}
                  {referrerWallet && (
                    <p className="text-xs text-white/60 mt-1 text-center">
                      {t('walletReferral') || 'Wallet Referral'}: {referrerWallet.slice(0, 6)}...{referrerWallet.slice(-4)}
                    </p>
                  )}
                  {fullKolId && !referrerWallet && (
                    <p className="text-xs text-white/60 mt-1 text-center">
                      {t('kolId')}: {fullKolId}
                    </p>
                  )}
                </div>

                {/* Amount Input Section */}
                <div className="text-center bg-white/5 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 border border-white/20 shadow-2xl">
                  <p className="text-white text-base sm:text-lg mb-3 sm:mb-4">{t('youreBuying') || "You're buying"}</p>
                  <div className="relative mb-4 sm:mb-6">
                    <span >$</span>
                    <input
                      type="number"
                      value={buyAmount}
                      onChange={(e) => setBuyAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full max-w-[200px] sm:w-48 rounded-xl px-2 py-3 sm:py-4 text-white text-xl sm:text-2xl font-semibold text-center bg-transparent border border-none focus:outline-none focus:ring-2 focus:ring-transparent focus:border-transparent"
                    />
                  </div>

                  {/* Amount Selection Buttons */}
                  <div className="flex justify-center gap-2 sm:gap-4 mb-4 sm:mb-6 flex-wrap">
                    <Button
                      onClick={() => handleAmountSelect(100)}
                      variant="outline"
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30 text-sm sm:text-base px-4 sm:px-6 py-2"
                    >
                      100
                    </Button>
                    <Button
                      onClick={() => handleAmountSelect(500)}
                      variant="outline"
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30 text-sm sm:text-base px-4 sm:px-6 py-2"
                    >
                      500
                    </Button>
                    <Button
                      onClick={() => handleAmountSelect(1000)}
                      variant="outline"
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30 text-sm sm:text-base px-4 sm:px-6 py-2"
                    >
                      1000
                    </Button>
                  </div>
                </div>

                {/* Review Button */}
                <div className="text-center">
                  <Button
                    onClick={handleReview}
                    disabled={!buyAmount || parseFloat(buyAmount) < MINIMUM_PURCHASE_AMOUNT || !address}
                    className="w-full bg-primary hover:bg-primary/80 text-white px-4 sm:px-16 py-4 sm:py-6 text-base sm:text-lg font-semibold rounded-xl uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('review').toUpperCase()}
                  </Button>
                  {buyAmount && parseFloat(buyAmount) > 0 && parseFloat(buyAmount) < MINIMUM_PURCHASE_AMOUNT && (
                    <p className="text-red-400 text-xs sm:text-sm mt-2">
                      Minimum purchase amount is ${MINIMUM_PURCHASE_AMOUNT}
                    </p>
                  )}
                </div>
              </PageCard>

             
            </>
          ) : (
            /* Review Section */
            <PageCard>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 text-center">{t('reviewPurchase')}</h2>
              
              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 sm:py-3 border-b border-white/10 gap-1 sm:gap-0">
                  <span className="text-white/80 text-sm sm:text-base">{t('wallet') || 'Wallet'}:</span>
                  <span className="text-white font-semibold text-sm sm:text-base break-all sm:break-normal">{formatAddress(address || '')}</span>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 sm:py-3 border-b border-white/10 gap-1 sm:gap-0">
                  <span className="text-white/80 text-sm sm:text-base">{t('pricePerTokenLabel')}:</span>
                  <span className="text-white font-semibold text-sm sm:text-base">
                    {isLoadingPrice ? 'Loading...' : `${pricePerToken} - ${pricePerToken}`}
                  </span>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 sm:py-3 border-b border-white/10 gap-1 sm:gap-0">
                  <span className="text-white/80 text-sm sm:text-base">{t('gasFee')}:</span>
                  <span className="text-white font-semibold text-sm sm:text-base">Auto</span>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 sm:py-3 border-b border-white/10 gap-1 sm:gap-0">
                  <span className="text-white/80 text-sm sm:text-base">{t('slippageUnit')}:</span>
                  <span className="text-white font-semibold text-sm sm:text-base">Auto</span>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 sm:py-3 border-b border-white/10 gap-1 sm:gap-0">
                  <span className="text-white/80 text-sm sm:text-base">{t('minimumReceivedLabel')}:</span>
                  <span className="text-white font-semibold text-sm sm:text-base">{minimumReceived}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  onClick={() => setShowReview(false)}
                  variant="outline"
                  className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20 text-sm sm:text-base py-3 sm:py-4"
                >
                  {t('back') || 'Back'}
                </Button>
                <Button
                  onClick={handleBuy}
                  disabled={isBuying || isApproving || !address}
                  className="flex-1 bg-primary hover:bg-primary/80 font-semibold uppercase cursor-pointer text-sm sm:text-base py-3 sm:py-4"
                >
                  {isApproving ? t('approving') : isBuying ? t('processing') : t('buyNow').toUpperCase()}
                </Button>
              </div>
            </PageCard>
          )}

          {/* Buyer Leaderboard Section */}
          <PageCard className="mt-6 sm:mt-8" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }}>
            <Leaderboard 
              leaderboard={buyerLeaderboard} 
              isLoading={isBuyerLeaderboardLoading} 
              type="buyer"
              currentAddress={address}
            />
          </PageCard>

          {/* Warning Notice */}
          <div className="my-8 bg-red-300/10 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-red-400/50 shadow-2xl">
            <div className="flex flex-col items-center gap-3 sm:gap-4">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-500 shrink-0 mt-1" />
              <div className="text-white text-center">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{t('noticeTitle')}</h3>
                <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
                  {t('noticeMessage')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </PageLayout>
  );
}

export default function BuyPage() {
  return (
    <Suspense fallback={
      <PageLayout showStickyDisclaimer>
        <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16">
          <div className="max-w-4xl mx-auto">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
              <p className="text-white mt-4">Loading...</p>
            </div>
          </div>
        </main>
      </PageLayout>
    }>
      <BuyPageContent />
    </Suspense>
  );
}

