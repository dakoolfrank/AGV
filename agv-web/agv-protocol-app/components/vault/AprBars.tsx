'use client';

import { useVaultStore } from '@/lib/vault/store';
import { formatNumber } from '@/lib/vault/math';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, Zap, Users } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';

export function AprBars() {
  const { t } = useTranslations();
  const { tier, tiers, isLoading } = useVaultStore();
  
  const tierData = tiers?.tiers[tier];
  
  if (isLoading || !tierData) {
    return (
      <Card className="w-full bg-white/5 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            APR Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-white/10 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { apr, split } = tierData;
  const realApr = apr * split.real;
  const boostApr = apr * split.boost;
  const socialApr = apr * split.social;

  const bars = [
    {
      label: t('vault.aprBars.real'),
      value: realApr,
      percentage: split.real * 100,
      color: 'bg-green-500',
      icon: TrendingUp,
      description: 'Base rewards from staking'
    },
    {
      label: t('vault.aprBars.boost'),
      value: boostApr,
      percentage: split.boost * 100,
      color: 'bg-blue-500',
      icon: Zap,
      description: 'Multiplier rewards from NFT tier'
    },
    {
      label: t('vault.aprBars.social'),
      value: socialApr,
      percentage: split.social * 100,
      color: 'bg-purple-500',
      icon: Users,
      description: 'Community and engagement rewards'
    }
  ];

  return (
    <Card className="w-full bg-white/5 backdrop-blur-xl border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <TrendingUp className="h-5 w-5 text-blue-400" />
          {t('vault.aprBars.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {bars.map((bar, index) => (
          <TooltipProvider key={index}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <bar.icon className="h-4 w-4 text-white/70" />
                      <span className="text-sm font-medium text-white">{bar.label}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-white">
                        {formatNumber(bar.value, 1)}%
                      </div>
                      <div className="text-xs text-white/60">
                        {formatNumber(bar.percentage, 1)}% of total
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-full bg-white/10 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${bar.color}`}
                      style={{ width: `${bar.percentage}%` }}
                    />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{bar.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
        
        <div className="pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-white">{t('vault.aprBars.total')}</span>
            <span className="text-2xl font-bold text-green-400">
              {formatNumber(apr, 1)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
