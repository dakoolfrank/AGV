'use client';

import { useState, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { BUY_CONTRACT_ADDRESS } from '@/lib/contracts';

export interface PassType {
  id: string;
  name: string;
  preGVTAmount: number;
  badgeId?: number;
  contractAddress?: string;
  description: string;
}

export const PASS_TYPES: PassType[] = [
  {
    id: 'seedpass',
    name: 'Seedpass',
    preGVTAmount: 1000,
    badgeId: 1,
    contractAddress: BUY_CONTRACT_ADDRESS,
    description: 'Basic access pass for early supporters'
  },
  {
    id: 'treepass',
    name: 'Treepass',
    preGVTAmount: 2000,
    badgeId: 2,
    contractAddress: BUY_CONTRACT_ADDRESS,
    description: 'Growth-focused pass for committed participants'
  },
  {
    id: 'solarpass',
    name: 'Solarpass',
    preGVTAmount: 5000,
    badgeId: 3,
    contractAddress: BUY_CONTRACT_ADDRESS,
    description: 'Premium pass for dedicated community members'
  },
  {
    id: 'computepass',
    name: 'Computepass',
    preGVTAmount: 10000,
    badgeId: 4,
    contractAddress: BUY_CONTRACT_ADDRESS,
    description: 'Elite pass for maximum rewards and benefits'
  }
];

export interface PassOwnership {
  passType: PassType;
  contractAddress: string;
  balance: number;
  tokenIds: number[];
}

export interface PassOwnershipState {
  ownership: PassOwnership | null;
  isLoading: boolean;
  error: string | null;
  hasPass: boolean;
  availablePasses: PassType[];
}

export function usePassOwnership() {
  const account = useActiveAccount();
  const [state, setState] = useState<PassOwnershipState>({
    ownership: null,
    isLoading: false,
    error: null,
    hasPass: false,
    availablePasses: [],
  });

  const checkPassOwnership = useCallback(async (passType: PassType): Promise<PassOwnership | null> => {
    // Pass ownership checking disabled - not using badge contract
    return null;
  }, []);

  const fetchOwnership = useCallback(async () => {
    if (!account?.address) {
      setState({
        ownership: null,
        isLoading: false,
        error: null,
        hasPass: false,
        availablePasses: [],
      });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const ownershipResults = await Promise.all(
        PASS_TYPES.map(passType => checkPassOwnership(passType))
      );

      const ownedPasses = ownershipResults.filter(result => result !== null) as PassOwnership[];
      const availablePassTypes = ownedPasses.map(ownership => ownership.passType);

      // Get the highest value pass if user owns multiple
      const highestValuePass = ownedPasses.reduce((highest, current) => 
        current.passType.preGVTAmount > highest.passType.preGVTAmount ? current : highest
      , ownedPasses[0]);

      setState({
        ownership: highestValuePass || null,
        isLoading: false,
        error: null,
        hasPass: ownedPasses.length > 0,
        availablePasses: availablePassTypes,
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to check pass ownership',
      }));
    }
  }, [account?.address, checkPassOwnership]);

  // Fetch ownership when account changes
  useEffect(() => {
    fetchOwnership();
  }, [fetchOwnership]);

  return {
    ...state,
    fetchOwnership,
  };
}
