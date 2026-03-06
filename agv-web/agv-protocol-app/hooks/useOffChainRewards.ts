// hooks/useOffChainRewards.ts
"use client";

import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";

export type RewardData = {
  wallet: string;
  asOf: string;
  totals: {
    accrued: number;
    scheduled: number;
    remaining: number;
  };
  stakes: Array<{
    id: string;
    chainId: string;
    nftType: string;
    amount: number;
    stakedAt: string;
    unlockAt: string;
    lockDays: number;
    baseDaily: number;
    bonusMultiplier: number;
    scheduledTotal: number;
    accrued: number;
    daysCounted: number;
    status: string;
    txHash?: string;
    kolId?: string;
  }>;
};

export function useOffChainRewards() {
  const account = useActiveAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RewardData | null>(null);

  useEffect(() => {
    (async () => {
      if (!account?.address) {
        setData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/rewards?wallet=${account.address}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch rewards: ${response.statusText}`);
        }
        
        const rewardData = await response.json();
        setData(rewardData);
      } catch (e: any) {
        setError(e?.message ?? "Failed to fetch rewards");
      } finally {
        setLoading(false);
      }
    })();
  }, [account?.address]);

  return { loading, error, data };
}
