import { useState, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';

interface WhitelistStatus {
  isWhitelisted: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useWhitelist() {
  const account = useActiveAccount();
  const address = account?.address;
  const [status, setStatus] = useState<WhitelistStatus>({
    isWhitelisted: false,
    isLoading: false,
    error: null,
  });

  const checkWhitelistStatus = useCallback(async () => {
    if (!address) {
      setStatus({
        isWhitelisted: false,
        isLoading: false,
        error: null,
      });
      return;
    }

    setStatus(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/whitelist?address=${address}`);
      const data = await response.json();
      if (data.success) {
        setStatus({
          isWhitelisted: data.data.isWhitelisted,
          isLoading: false,
          error: null,
        });
      } else {
        setStatus({
          isWhitelisted: false,
          isLoading: false,
          error: data.error || 'Failed to check whitelist status',
        });
      }
    } catch (error) {
      setStatus({
        isWhitelisted: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [address]);

  // Check whitelist status when address changes
  useEffect(() => {
    checkWhitelistStatus();
  }, [checkWhitelistStatus]);

  return {
    ...status,
    checkWhitelistStatus,
  };
}
