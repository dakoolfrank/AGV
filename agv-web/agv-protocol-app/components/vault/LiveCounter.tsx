'use client';

import { useVaultStore } from '@/lib/vault/store';
import { useLiveCounter } from '@/lib/vault/useLiveCounter';
import { formatNumber, formatLargeNumber } from '@/lib/vault/math';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Lock, Unlock } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';
import { getUnlockTimestamp } from '@/lib/vault/useCountdown';

export function LiveCounter() {
  const { t } = useTranslations();
  const { 
    tier, 
    tiers, 
    rggpAccrued, 
    perSecondRate, 
    dailyYieldTotal,
    isLoading,
    lockedNfts,
    unlockAllNfts
  } = useVaultStore();

  // Show 0 rewards if no NFTs are locked
  const effectiveRggpAccrued = lockedNfts.length > 0 ? rggpAccrued : 0;
  const effectivePerSecondRate = lockedNfts.length > 0 ? perSecondRate : 0;
  const effectiveDailyYieldTotal = lockedNfts.length > 0 ? dailyYieldTotal : 0;
  
  const liveValue = useLiveCounter(effectiveRggpAccrued, effectivePerSecondRate);
  
  const tierData = tiers?.tiers[tier];
  const apr = tierData?.apr || 0;

  if (isLoading) {
    return (
      <Card className="w-full bg-white/5 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            Live rGGP Counter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-16 bg-white/10 rounded mb-4"></div>
            <div className="h-4 bg-white/10 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-white/10 rounded w-1/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-white/5 backdrop-blur-xl border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <TrendingUp className="h-5 w-5 text-blue-400" />
          {t('vault.liveCounter.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Counter */}
        <div className="text-center">
          <div 
            className="text-4xl sm:text-5xl font-bold text-green-400 mb-2"
            aria-live="polite"
            aria-label={`Current rGGP balance: ${formatNumber(liveValue, 4)}`}
          >
            {formatNumber(liveValue, 4)}
          </div>
          <div className="text-sm text-white/70">
            {t('vault.liveCounter.accrued')}
          </div>
        </div>

        {/* APR Display */}
        <div className="flex items-center justify-center gap-2">
          <Badge variant="outline" className="text-lg px-4 py-2 border-white/20 text-white bg-white/10">
            {apr}% APR
          </Badge>
          <span className="text-sm text-white/70">
            {tier === 'flex' ? 'Flexible' : `${tier} Lock`}
          </span>
        </div>

        {/* Daily Yield Info */}
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-semibold text-blue-400">
                {formatNumber(effectiveDailyYieldTotal, 2)}
              </div>
              <div className="text-xs text-white/70">
                {t('vault.liveCounter.dailyYield')}
              </div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-purple-400">
                {formatNumber(effectivePerSecondRate * 86400, 2)}
              </div>
              <div className="text-xs text-white/70">
                {t('vault.liveCounter.perSecond')}
              </div>
            </div>
          </div>
        </div>

        {/* Lock Tier CTA */}
        {tier === 'flex' && (
          <div className="text-center">
            <Button className="w-full" size="lg" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <Lock className="h-4 w-4 mr-2" />
              {t('vault.liveCounter.lockTierCta')}
            </Button>
            <p className="text-xs text-white/60 mt-2">
              {t('vault.liveCounter.lockTierDescription')}
            </p>
          </div>
        )}

        {/* Unlock All Button */}
        {lockedNfts.length > 0 && (
          <div className="text-center">
            {(() => {
              // Check if any NFTs can be unlocked
              const canUnlockAny = lockedNfts.some(nft => {
                const unlockTimestamp = getUnlockTimestamp(nft.lockTimestamp, nft.lockTier);
                return nft.lockTier === 'flex' || Date.now() / 1000 >= unlockTimestamp;
              });
              
              return (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={`w-full ${
                    canUnlockAny 
                      ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' 
                      : 'bg-gray-500/10 border-gray-500/20 text-gray-400 cursor-not-allowed'
                  }`}
                  disabled={!canUnlockAny}
                  onClick={() => {
                    if (canUnlockAny && confirm(t('vault.unlock.confirmAll', { count: lockedNfts.length }))) {
                      unlockAllNfts();
                    }
                  }}
                >
                  <Unlock className="h-4 w-4 mr-2" />
                  {canUnlockAny ? t('vault.liveCounter.unlockAll') : t('vault.unlock.cannotUnlockYet')}
                </Button>
              );
            })()}
            <p className="text-xs text-red-400/60 mt-2">
              {t('vault.liveCounter.unlockAllDescription')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
