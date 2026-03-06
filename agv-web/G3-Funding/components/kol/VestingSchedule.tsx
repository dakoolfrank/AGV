'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Wallet, Loader2, AlertCircle } from 'lucide-react';
import { VPreGVT_CONTRACT_ADDRESS, VPreGVT_CONTRACT_ABI } from '@/lib/contracts';
import { getContract, readContract, defineChain } from 'thirdweb';
import { createThirdwebClient } from 'thirdweb';

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

const TOKEN_DECIMALS = 18;

const RPC_ENDPOINTS = [
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.defibit.io/",
  "https://bsc-dataseed1.ninicoin.io/",
  "https://bsc-dataseed2.defibit.io/"
];

interface VestingScheduleData {
  schedule: {
    start: bigint;
    cliff: bigint;
    duration: bigint;
    total: bigint;
    claimed: bigint;
    immutable_: boolean;
  } | null;
  isGlobal: boolean;
  vestedAmount?: bigint;
  unlockedAmount?: bigint;
}

interface VestingScheduleProps {
  walletAddress: string | null;
}

export function VestingSchedule({ walletAddress }: VestingScheduleProps) {
  const [vestingSchedule, setVestingSchedule] = useState<VestingScheduleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize client to prevent recreation on every render
  const client = useMemo(() => createThirdwebClient({
    clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "your-client-id"
  }), []);

  const loadVestingSchedule = useCallback(async () => {
    if (!walletAddress) {
      setVestingSchedule(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      let contract = null;
      let workingRpc = null;
      
      // Try multiple RPC endpoints for better reliability
      for (const rpc of RPC_ENDPOINTS) {
        try {
          const testChain = defineChain({
            ...BSC_CHAIN,
            rpc: rpc,
          });
          
          contract = getContract({
            client,
            address: VPreGVT_CONTRACT_ADDRESS,
            chain: testChain,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            abi: VPreGVT_CONTRACT_ABI as any,
          });
          
          // Test this RPC with a simple call
          await readContract({
            contract,
            method: "balanceOf",
            params: [walletAddress],
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

      // Call getEffectiveSchedule - this is the main call that matches balance page
      const result = await readContract({
        contract,
        method: "getEffectiveSchedule",
        params: [walletAddress],
      }) as [{ start: bigint; cliff: bigint; duration: bigint; total: bigint; claimed: bigint; immutable_: boolean }, boolean];

      if (!result || !result[0]) {
        setVestingSchedule(null);
        return;
      }

      const [schedule, isGlobal] = result;

      // Optionally fetch vested and unlocked amounts for better UX
      let vestedAmount: bigint | undefined;
      let unlockedAmount: bigint | undefined;

      try {
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
        vestedAmount = await readContract({
          contract,
          method: "vestedAmount",
          params: [walletAddress],
        }) as bigint | undefined;

        await new Promise(resolve => setTimeout(resolve, 200));
        
        unlockedAmount = await readContract({
          contract,
          method: "unlockedAmount",
          params: [walletAddress],
        }) as bigint | undefined;
      } catch (err) {
        console.warn('[VestingSchedule] Failed to fetch vested/unlocked amounts:', err);
        // Don't fail the whole request if these calls fail
      }
      
      setVestingSchedule({
        schedule,
        isGlobal,
        vestedAmount,
        unlockedAmount,
      });
    } catch (err) {
      console.error('Error loading vesting schedule:', err);
      setError(err instanceof Error ? err.message : 'Failed to load vesting schedule');
      setVestingSchedule(null);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, client]);

  // Load data when walletAddress changes
  useEffect(() => {
    if (walletAddress) {
      loadVestingSchedule();
    }
  }, [walletAddress, loadVestingSchedule]);

  if (!walletAddress) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wallet className="h-5 w-5 text-blue-600" />
            <span>Vesting Schedule</span>
          </CardTitle>
          <CardDescription>
            Connect your wallet to view your vesting schedule
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 text-center py-4">
            Please connect your wallet to view your vesting information.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wallet className="h-5 w-5" />
            <span>Vesting Schedule</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4 py-6">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
            <p className="text-sm text-gray-600">Loading vesting schedule...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span>Error Loading Vesting Schedule</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!vestingSchedule || !vestingSchedule.schedule) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wallet className="h-5 w-5" />
            <span>Vesting Schedule</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4 py-6">
            <Wallet className="w-12 h-12 text-gray-400 mx-auto" />
            <p className="text-sm text-gray-600">No vesting schedule found for this wallet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(num);
  };

  const schedule = vestingSchedule.schedule;
  const vestedAmountNum = vestingSchedule.vestedAmount 
    ? Number(vestingSchedule.vestedAmount) / 10 ** TOKEN_DECIMALS 
    : null;
  const unlockedAmountNum = vestingSchedule.unlockedAmount 
    ? Number(vestingSchedule.unlockedAmount) / 10 ** TOKEN_DECIMALS 
    : null;
  const totalAmount = Number(schedule.total) / 10 ** TOKEN_DECIMALS;
  const claimedAmount = Number(schedule.claimed) / 10 ** TOKEN_DECIMALS;
  const remainingAmount = totalAmount - claimedAmount;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wallet className="h-5 w-5 text-primary" />
            <span>Vesting Schedule</span>
          </CardTitle>
          <CardDescription>
            Wallet: <span className="font-mono text-xs">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Schedule Type Badge */}
          <div className={`p-4 rounded-lg border ${
            vestingSchedule.isGlobal 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-purple-50 border-purple-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Schedule Type:</span>
              <Badge className={`${
                vestingSchedule.isGlobal
                  ? 'bg-blue-500 text-white'
                  : 'bg-purple-500 text-white'
              }`}>
                {vestingSchedule.isGlobal ? 'Global Schedule' : 'Custom Schedule'}
              </Badge>
            </div>
            {!vestingSchedule.isGlobal && (
              <p className="text-xs text-purple-600 mt-2">
                This wallet has a custom vesting schedule
              </p>
            )}
          </div>

          {/* Vested and Unlocked Amounts (if available) */}
          {(vestedAmountNum !== null || unlockedAmountNum !== null) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vestedAmountNum !== null && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Vested Amount</span>
                  </div>
                  <p className="text-2xl font-bold text-green-900">
                    {formatNumber(vestedAmountNum)} sGVT
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    of {formatNumber(totalAmount)} sGVT total
                  </p>
                </div>
              )}

              {unlockedAmountNum !== null && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <Wallet className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Unlocked Amount</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatNumber(unlockedAmountNum)} sGVT
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Available to claim
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Schedule Details Grid - matching balance page format */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Start */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-600 text-xs mb-1">Start (Unix Timestamp)</p>
              <p className="text-gray-900 font-mono text-sm break-all">
                {schedule.start.toString()}
              </p>
              <p className="text-gray-600 text-xs mt-1">
                {new Date(Number(schedule.start) * 1000).toLocaleString()}
              </p>
            </div>

            {/* Cliff */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-600 text-xs mb-1">Cliff (Unix Timestamp)</p>
              <p className="text-gray-900 font-mono text-sm break-all">
                {schedule.cliff.toString()}
              </p>
              <p className="text-gray-600 text-xs mt-1">
                {new Date(Number(schedule.cliff) * 1000).toLocaleString()}
              </p>
            </div>

            {/* Duration */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-600 text-xs mb-1">Duration (Seconds)</p>
              <p className="text-gray-900 font-mono text-sm">
                {schedule.duration.toString()}
              </p>
              <p className="text-gray-600 text-xs mt-1">
                {Math.floor(Number(schedule.duration) / (60 * 60 * 24))} days
              </p>
            </div>

            {/* Total */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-600 text-xs mb-1">Total (Wei)</p>
              <p className="text-gray-900 font-mono text-sm break-all">
                {schedule.total.toString()}
              </p>
              <p className="text-gray-600 text-xs mt-1">
                {formatNumber(totalAmount)} sGVT
              </p>
            </div>

            {/* Claimed */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-600 text-xs mb-1">Claimed (Wei)</p>
              <p className="text-gray-900 font-mono text-sm break-all">
                {schedule.claimed.toString()}
              </p>
              <p className="text-gray-600 text-xs mt-1">
                {formatNumber(claimedAmount)} sGVT
              </p>
            </div>

            {/* Remaining */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-600 text-xs mb-1">Remaining</p>
              <p className="text-gray-900 font-semibold text-lg">
                {formatNumber(remainingAmount)} sGVT
              </p>
              <p className="text-gray-600 text-xs mt-1">
                {formatNumber((remainingAmount / totalAmount) * 100)}% remaining
              </p>
            </div>

            {/* Immutable */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-600 text-xs mb-1">Immutable</p>
              <p className={`text-sm font-semibold ${
                schedule.immutable_ 
                  ? 'text-red-600' 
                  : 'text-green-600'
              }`}>
                {schedule.immutable_ ? 'Yes (Locked)' : 'No (Can be modified)'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
