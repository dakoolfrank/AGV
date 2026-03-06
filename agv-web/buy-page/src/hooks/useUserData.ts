import { useState, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useNftOwnership } from '@/lib/useNftOwnership';
import { User, LeaderboardEntry, ApiResponse } from '@/lib/types';

export function useUserData() {
  const account = useActiveAccount();
  const address = account?.address;
  const { ownership, hasBadge } = useNftOwnership();
  const [userData, setUserData] = useState<User | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to update airdrop badge ownership in database
  const updateAirdropBadgeOwnership = useCallback(async () => {
    if (!address || !hasBadge || !ownership) return;

    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          action: 'update-nft-ownership',
          nftOwnership: {
            '56': { // BSC chain ID
              airdropBadge: {
                balance: ownership.balance,
                tokenIds: ownership.tokenIds,
                lastChecked: new Date().toISOString(),
              }
            }
          }
        })
      });
    } catch (err) {
      console.error('Failed to update airdrop badge ownership:', err);
    }
  }, [address, hasBadge, ownership]);

  const fetchUserData = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/users?address=${address}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      const data: ApiResponse<User> = await response.json();
      
      if (data.success && data.data) {
        setUserData(data.data);
        
        // Update airdrop badge ownership in database if we have new ownership data
        if (hasBadge) {
          await updateAirdropBadgeOwnership();
        }
      } else {
        throw new Error(data.error || 'Failed to fetch user data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [address, hasBadge, updateAirdropBadgeOwnership]);

  const fetchLeaderboard = useCallback(async (type: 'buyer' | 'referral' | 'activation' = 'activation') => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/users?type=${type}`);
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }
      const data: ApiResponse<LeaderboardEntry[]> = await response.json();
      
      if (data.success && data.data) {
        console.log('Leaderboard data:', data.data);
        setLeaderboard(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch leaderboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);


  const activateWallet = useCallback(async () => {
    if (!address) return false;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          action: 'activate'
        })
      });

      if (!response.ok) {
        const errorData: ApiResponse = await response.json();
        throw new Error(errorData.error || 'Failed to activate wallet');
      }

      const data: ApiResponse<User> = await response.json();
      if (data.success && data.data) {
        setUserData(data.data);
        return true;
      } else {
        throw new Error(data.error || 'Failed to activate wallet');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  const redeemBadge = useCallback(async (redeemedAmount: number = 1000) => {
    if (!address) return false;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          action: 'redeem',
          redeemedAmount
        })
      });

      if (!response.ok) {
        const errorData: ApiResponse = await response.json();
        throw new Error(errorData.error || 'Failed to redeem badge');
      }

      const data: ApiResponse<User> = await response.json();
      if (data.success && data.data) {
        setUserData(data.data);
        return true;
      } else {
        throw new Error(data.error || 'Failed to redeem badge');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  const updateEarnings = useCallback(async () => {
    if (!address || !userData?.isActivated) return;

    try {
      // Earnings are automatically updated when fetching user data
      await fetchUserData();
    } catch (err) {
      console.error('Failed to update earnings:', err);
    }
  }, [address, userData?.isActivated, fetchUserData]);

  // Auto-update earnings every minute
  useEffect(() => {
    if (userData?.isActivated) {
      const interval = setInterval(updateEarnings, 60000); // Update every minute
      return () => clearInterval(interval);
    }
  }, [userData?.isActivated, updateEarnings]);

  // Fetch user data when address changes
  useEffect(() => {
    if (address) {
      fetchUserData();
    } else {
      setUserData(null);
    }
  }, [address, fetchUserData]);

  return {
    userData,
    leaderboard,
    isLoading,
    error,
    fetchUserData,
    fetchLeaderboard,
    activateWallet,
    redeemBadge,
    updateEarnings,
    // Airdrop badge ownership data
    nftOwnership: ownership,
    hasAnyNft: hasBadge,
    checkEligibility: () => hasBadge,
    getNftDetails: () => ownership,
  };
}
