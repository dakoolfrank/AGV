"use client";

import { useState, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { getContract, readContract } from 'thirdweb';
import { createThirdwebClient } from 'thirdweb';
import { BUY_CONTRACT_ADDRESS, buy_ABI } from './contracts';

interface AirdropBadgeOwnership {
  contractAddress: string;
  balance: number;
  tokenIds: number[];
}

interface AirdropBadgeState {
  ownership: AirdropBadgeOwnership | null;
  isLoading: boolean;
  error: string | null;
  hasBadge: boolean;
}

export function useNftOwnership() {
  const account = useActiveAccount();
  const [state, setState] = useState<AirdropBadgeState>({
    ownership: null,
    isLoading: false,
    error: null,
    hasBadge: false,
  });

  const checkAirdropBadgeOwnership = useCallback(async () => {
    if (!account?.address) return null;

    try {
      // Create thirdweb client
      const client = createThirdwebClient({
        clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "your-client-id"
      });

      const buyContract = getContract({
        client,
        address: BUY_CONTRACT_ADDRESS,
        chain: {
          id: 56, // BSC mainnet
          rpc: "https://bsc-dataseed.binance.org/"
        },
        abi: buy_ABI as any,
      });

      // Note: buy_ABI doesn't have ERC1155 balanceOf(address, id)
      // Check if user has badge using hasBadge function
      const hasBadge = await readContract({
        contract: buyContract,
        method: "hasBadge",
        params: [account.address],
      });

      const balanceNumber = hasBadge ? 1 : 0;
      if (balanceNumber > 0) {
        // Get badge ID from buy contract
        const badgeId = await readContract({
          contract: buyContract,
          method: "badgeId",
          params: [],
        });

        return {
          contractAddress: BUY_CONTRACT_ADDRESS,
          balance: balanceNumber,
          tokenIds: [Number(badgeId)],
        };
      }

      return null;
    } catch (err) {
      console.warn('Failed to check airdrop badge ownership:', err);
      return null;
    }
  }, [account?.address]);

  const fetchOwnership = useCallback(async () => {
    if (!account?.address) {
      setState({
        ownership: null,
        isLoading: false,
        error: null,
        hasBadge: false,
      });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const ownership = await checkAirdropBadgeOwnership();

      setState({
        ownership,
        isLoading: false,
        error: null,
        hasBadge: ownership !== null && ownership.balance > 0,
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to check airdrop badge ownership',
      }));
    }
  }, [account?.address, checkAirdropBadgeOwnership]);

  // Fetch ownership when account changes
  useEffect(() => {
    fetchOwnership();
  }, [fetchOwnership]);

  return {
    ...state,
    fetchOwnership,
  };
}
