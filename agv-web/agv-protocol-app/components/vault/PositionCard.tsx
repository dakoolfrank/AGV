'use client';

import { useVaultStore, LockedNFT } from '@/lib/vault/store';
import { formatNumber, formatWalletAddress } from '@/lib/vault/math';
import { dailyYield, calculateAccrued } from '@/lib/vault/math';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sprout, TreePine, Sun, Cpu, Unlock } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';
import { CountdownTimer, UnlockTimestamp } from './CountdownTimer';
import { getUnlockTimestamp } from '@/lib/vault/useCountdown';

interface PositionCardProps {
  lockedNft: LockedNFT;
  index: number;
}

const nftIcons = {
  seed: Sprout,
  tree: TreePine,
  solar: Sun,
  compute: Cpu
};

const nftColors = {
  seed: 'text-green-400',
  tree: 'text-amber-400',
  solar: 'text-yellow-400',
  compute: 'text-blue-400'
};

const nftBgColors = {
  Seed: 'bg-green-50 dark:bg-green-950/20',
  Tree: 'bg-blue-50 dark:bg-blue-950/20',
  Solar: 'bg-yellow-50 dark:bg-yellow-950/20'
};

export function PositionCard({ lockedNft, index }: PositionCardProps) {
  const { t } = useTranslations();
  const { tier, tiers, xp, unlockNft } = useVaultStore();
  
  if (!tiers || !xp) return null;

  const tierData = tiers.tiers[tier];
  const nftMultiplier = tiers.nftMultipliers[lockedNft.nftType as keyof typeof tiers.nftMultipliers] || 1;
  const dailyYieldForNft = dailyYield(tierData.apr, nftMultiplier, xp.xp);
  const accrued = calculateAccrued(lockedNft.lockTimestamp, dailyYieldForNft);
  
  const Icon = nftIcons[lockedNft.nftType as keyof typeof nftIcons] || Sprout;
  const colorClass = nftColors[lockedNft.nftType as keyof typeof nftColors] || 'text-gray-400';

  const startDate = new Date(lockedNft.lockTimestamp * 1000);
  const daysStaked = Math.floor((Date.now() - lockedNft.lockTimestamp * 1000) / (1000 * 60 * 60 * 24));
  
  // Check if NFT can be unlocked
  const unlockTimestamp = getUnlockTimestamp(lockedNft.lockTimestamp, lockedNft.lockTier);
  const canUnlock = lockedNft.lockTier === 'flex' || Date.now() / 1000 >= unlockTimestamp;

  return (
    <Card className="w-full bg-white/5 backdrop-blur-xl border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-white/10 ${colorClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-white">{lockedNft.name || `${lockedNft.nftType.toUpperCase()} NFT`}</div>
              <div className="text-sm text-white/70">
                Token ID: {lockedNft.tokenIdStr}
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs bg-white/10 border-white/20 text-white">
            {nftMultiplier}x {t('vault.positions.multiplier')}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {formatNumber(accrued, 4)}
            </div>
            <div className="text-xs text-white/70">
              rGGP Accrued
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">
              {formatNumber(dailyYieldForNft, 4)}
            </div>
            <div className="text-xs text-white/70">
              {t('vault.liveCounter.dailyYield')}
            </div>
          </div>
        </div>

        {/* Staking Info */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/70">Staked Since:</span>
            <span className="font-medium text-white">
              {startDate.toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/70">{t('vault.positions.daysStaked')}</span>
            <span className="font-medium text-white">{daysStaked} days</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/70">{t('vault.positions.lockTier')}</span>
            <Badge variant="outline" className="text-xs bg-white/10 border-white/20 text-white">
              {lockedNft.lockTier}
            </Badge>
          </div>
          
          {/* Countdown Timer */}
          <div className="flex justify-center">
            <CountdownTimer 
              lockTimestamp={lockedNft.lockTimestamp} 
              tier={lockedNft.lockTier}
            />
          </div>
          
          {/* Unlock Timestamp */}
          <UnlockTimestamp 
            lockTimestamp={lockedNft.lockTimestamp} 
            tier={lockedNft.lockTier}
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20"
            disabled
          >
            {t('vault.positions.claimRewards')}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className={`w-full ${
              canUnlock 
                ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' 
                : 'bg-gray-500/10 border-gray-500/20 text-gray-400 cursor-not-allowed'
            }`}
            disabled={!canUnlock}
            onClick={() => {
              if (canUnlock && confirm(t('vault.unlock.confirmSingle'))) {
                unlockNft(lockedNft.tokenAddress, lockedNft.tokenIdStr);
              }
            }}
          >
            <Unlock className="h-4 w-4 mr-2" />
            {canUnlock ? t('vault.positions.unlockNft') : t('vault.unlock.cannotUnlockYet')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PositionsList() {
  const { t } = useTranslations();
  const { lockedNfts, isLoading } = useVaultStore();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="w-full bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader>
              <div className="animate-pulse">
                <div className="h-6 bg-white/20 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-white/20 rounded w-1/2"></div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-12 bg-white/20 rounded"></div>
                  <div className="h-12 bg-white/20 rounded"></div>
                </div>
                <div className="h-8 bg-white/20 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (lockedNfts.length === 0) {
    return (
      <Card className="w-full bg-white/5 backdrop-blur-xl border-white/10">
        <CardContent className="text-center py-12">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-green-500/20">
                <Sprout className="h-12 w-12 text-green-400" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-white">{t('vault.positions.noNfts')}</h3>
              <p className="text-white/70 mb-4">
                {t('vault.positions.noNftsDescription')}
              </p>
              <Button className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                Mint & Stake NFTs
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">{t('vault.positions.title')}</h3>
      {lockedNfts.map((lockedNft, index) => (
        <PositionCard key={`${lockedNft.tokenAddress}-${lockedNft.tokenIdStr}`} lockedNft={lockedNft} index={index} />
      ))}
    </div>
  );
}
