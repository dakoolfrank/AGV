'use client';

import { useState, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { getContract, readContract, defineChain } from 'thirdweb';
import { createThirdwebClient } from 'thirdweb';
import { BUY_CONTRACT_ADDRESS, buy_ABI } from '@/lib/contracts';

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

export interface PresaleContractData {
  balance: bigint | null;
  presaleRemaining: bigint | null;
  presaleSold: bigint | null;
  presaleActive: boolean | null;
  presaleSupplyCap: bigint | null;
  isLoading: boolean;
  error: string | null;
}

export function usePresaleContract() {
  const account = useActiveAccount();
  const address = account?.address;

  const [data, setData] = useState<PresaleContractData>({
    balance: null,
    presaleRemaining: null,
    presaleSold: null,
    presaleActive: null,
    presaleSupplyCap: null,
    isLoading: false,
    error: null,
  });

  const fetchContractData = useCallback(async () => {
    if (!BUY_CONTRACT_ADDRESS) {
      setData(prev => ({ ...prev, error: 'Contract address not configured', isLoading: false }));
      return;
    }

    setData(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const client = createThirdwebClient({
        clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "your-client-id"
      });

      // Try multiple RPC endpoints for better reliability
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
        throw new Error('Failed to connect to BSC network');
      }

      // Fetch all contract data in parallel
      const [
        presaleRemaining,
        presaleSold,
        presaleActive,
        presaleSupplyCap,
        balance
      ] = await Promise.all([
        readContract({
          contract,
          method: "presaleRemaining",
          params: [],
        }),
        readContract({
          contract,
          method: "presaleSold",
          params: [],
        }),
        readContract({
          contract,
          method: "presaleActive",
          params: [],
        }),
        readContract({
          contract,
          method: "presaleSupplyCap",
          params: [],
        }),
        address ? readContract({
          contract,
          method: "balanceOf",
          params: [address],
        }) : Promise.resolve(null),
      ]);

      setData({
        balance: balance as bigint | null,
        presaleRemaining: presaleRemaining as bigint,
        presaleSold: presaleSold as bigint,
        presaleActive: presaleActive as boolean,
        presaleSupplyCap: presaleSupplyCap as bigint,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('Error fetching contract data:', err);
      setData(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to fetch contract data',
        isLoading: false,
      }));
    }
  }, [address]);

  useEffect(() => {
    fetchContractData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchContractData, 30000);
    
    return () => clearInterval(interval);
  }, [fetchContractData]);

  return {
    ...data,
    refetch: fetchContractData,
  };
}

