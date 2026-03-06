'use client';

import React, { useEffect, useState } from 'react';
import { PageCard } from '@/components/ui/PageCard';
import { Calendar, Clock, TrendingUp, Wallet, Loader2, AlertCircle } from 'lucide-react';

interface VestingSchedule {
  id: string;
  kolId: string;
  walletAddress: string;
  totalAmount: number;
  vestedAmount: number;
  remainingAmount: number;
  startDate: Date | string;
  endDate: Date | string;
  cliffDate: Date | string;
  cliffDays: number;
  duration: number;
  vestingDays: number;
  dailyVestAmount: number;
  lastClaimAt?: Date | string;
  status: 'active' | 'completed' | 'cancelled';
}

interface VestingScheduleProps {
  walletAddress: string | null;
}

export function VestingSchedule({ walletAddress }: VestingScheduleProps) {
  const [vestingData, setVestingData] = useState<VestingSchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVestingData = async () => {
      if (!walletAddress) {
        setVestingData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/vesting?wallet=${encodeURIComponent(walletAddress)}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch vesting data' }));
          throw new Error(errorData.error || 'Failed to fetch vesting data');
        }

        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        setVestingData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchVestingData();
  }, [walletAddress]);

  if (!walletAddress) {
    return (
      <PageCard style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: 'rgba(96, 165, 250, 0.3)' }}>
        <div className="text-center space-y-4 py-6">
          <div className="flex justify-center">
            <Wallet className="w-12 h-12 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Vesting Schedule</h3>
            <p className="text-slate-300 text-sm sm:text-base">
              Connect your wallet to view your vesting schedule
            </p>
          </div>
        </div>
      </PageCard>
    );
  }

  if (loading) {
    return (
      <PageCard style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }}>
        <div className="text-center space-y-4 py-6">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-slate-300 text-sm sm:text-base">Loading vesting schedule...</p>
        </div>
      </PageCard>
    );
  }

  if (error) {
    return (
      <PageCard style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(248, 113, 113, 0.3)' }}>
        <div className="text-center space-y-4 py-6">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <div>
            <h3 className="text-xl font-bold text-red-400 mb-2">Error Loading Vesting Schedule</h3>
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </div>
      </PageCard>
    );
  }

  if (!vestingData) {
    return (
      <PageCard style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }}>
        <div className="text-center space-y-4 py-6">
          <Wallet className="w-12 h-12 text-slate-400 mx-auto" />
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Vesting Schedule</h3>
            <p className="text-slate-300 text-sm">No vesting schedule found for this wallet.</p>
          </div>
        </div>
      </PageCard>
    );
  }

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const calculateProgress = () => {
    const now = new Date();
    const start = new Date(vestingData.startDate);
    const end = new Date(vestingData.endDate);
    
    if (now < start) return 0;
    if (now >= end) return 100;
    
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    return Math.min(100, (elapsed / total) * 100);
  };

  const progress = calculateProgress();
  const isCliffPassed = new Date() >= new Date(vestingData.cliffDate);
  const isVestingComplete = vestingData.status === 'completed';

  return (
    <PageCard style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }} className="mb-6 sm:mb-8">
      <div className="flex items-center mb-4 sm:mb-6">
        <div className="p-2 sm:p-3 bg-purple-500/20 rounded-full border border-purple-500/30 mr-3 sm:mr-4">
          <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
        </div>
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-white">Vesting Schedule</h3>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Wallet: <span className="font-mono">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
          </p>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-6">
        {/* Vested Amount */}
        <div className="p-4 sm:p-6 bg-green-500/10 rounded-xl border border-green-500/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              <span className="text-sm sm:text-base font-medium text-green-300">Vested Amount</span>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              isVestingComplete 
                ? 'bg-green-500 text-white' 
                : 'bg-green-400/20 text-green-300 border border-green-400/30'
            }`}>
              {vestingData.status}
            </span>
          </div>
          <p className="text-3xl sm:text-4xl font-bold text-green-400 mb-1">
            {formatNumber(vestingData.vestedAmount)} sGVT
          </p>
          <p className="text-xs sm:text-sm text-green-300/80">
            of {formatNumber(vestingData.totalAmount)} sGVT total
          </p>
        </div>

        {/* Vesting Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Start Date */}
          <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/30">
            <div className="flex items-center space-x-2 mb-2">
              <Calendar className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-300">Start Date</span>
            </div>
            <p className="text-lg sm:text-xl font-semibold text-white">
              {formatDate(vestingData.startDate)}
            </p>
          </div>

          {/* Cliff Date */}
          <div className={`p-4 rounded-xl border ${
            isCliffPassed 
              ? 'bg-green-500/10 border-green-500/30' 
              : 'bg-orange-500/10 border-orange-500/30'
          }`}>
            <div className="flex items-center space-x-2 mb-2">
              <Clock className={`h-4 w-4 ${isCliffPassed ? 'text-green-400' : 'text-orange-400'}`} />
              <span className={`text-sm font-medium ${isCliffPassed ? 'text-green-300' : 'text-orange-300'}`}>
                Cliff Date
              </span>
              {isCliffPassed && (
                <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full font-semibold">Passed</span>
              )}
            </div>
            <p className={`text-lg sm:text-xl font-semibold ${isCliffPassed ? 'text-white' : 'text-orange-300'}`}>
              {formatDate(vestingData.cliffDate)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {vestingData.cliffDays} days from start
            </p>
          </div>

          {/* Duration */}
          <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-300">Duration</span>
            </div>
            <p className="text-lg sm:text-xl font-semibold text-white">
              {vestingData.duration} days
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Ends: {formatDate(vestingData.endDate)}
            </p>
          </div>

          {/* Remaining Amount */}
          <div className="p-4 bg-slate-700/50 rounded-xl border border-slate-600/30">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-300">Remaining</span>
            </div>
            <p className="text-lg sm:text-xl font-semibold text-white">
              {formatNumber(vestingData.remainingAmount)} sGVT
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {formatNumber((vestingData.remainingAmount / vestingData.totalAmount) * 100)}% remaining
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-300">Vesting Progress</span>
            <span className="font-medium text-white">{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-700/50 rounded-full h-3 sm:h-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-500 to-blue-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Additional Info */}
        <div className="pt-4 border-t border-slate-700/50 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Daily Vest Amount:</span>
            <span className="font-medium text-white">{formatNumber(vestingData.dailyVestAmount)} sGVT/day</span>
          </div>
          {vestingData.lastClaimAt && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Last Claim:</span>
              <span className="font-medium text-white">{formatDate(vestingData.lastClaimAt)}</span>
            </div>
          )}
        </div>
      </div>
    </PageCard>
  );
}

