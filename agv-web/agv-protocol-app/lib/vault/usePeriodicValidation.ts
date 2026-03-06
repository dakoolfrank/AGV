'use client';

import { useEffect, useRef } from 'react';
import { useVaultStore } from './store';

export function usePeriodicValidation() {
  const { performPeriodicValidation, lockedNfts, wallet } = useVaultStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only start validation if we have locked NFTs and a wallet
    if (lockedNfts.length > 0 && wallet) {
      // Perform initial validation
      performPeriodicValidation();

      // Set up interval for every 30 minutes
      intervalRef.current = setInterval(() => {
        performPeriodicValidation();
      }, 30 * 60 * 1000); // 30 minutes

      console.log('Started periodic NFT validation (every 30 minutes)');
    } else {
      // Clear interval if no locked NFTs or wallet
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log('Stopped periodic NFT validation');
      }
    }

    // Cleanup on unmount or dependency change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [lockedNfts.length, wallet, performPeriodicValidation]);

  // Also validate when the page becomes visible (user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && lockedNfts.length > 0 && wallet) {
        performPeriodicValidation();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lockedNfts.length, wallet, performPeriodicValidation]);
}
