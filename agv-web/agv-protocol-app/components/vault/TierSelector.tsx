'use client';

import { useVaultStore } from '@/lib/vault/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, Clock, TrendingUp } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';

const TIER_OPTIONS = [
  { value: 'flex', color: 'bg-green-500/20 text-green-400 border-green-500/20' },
  { value: '1m', color: 'bg-blue-500/20 text-blue-400 border-blue-500/20' },
  { value: '3m', color: 'bg-purple-500/20 text-purple-400 border-purple-500/20' },
  { value: '6m', color: 'bg-orange-500/20 text-orange-400 border-orange-500/20' },
  { value: '12m', color: 'bg-red-500/20 text-red-400 border-red-500/20' }
];

interface TierSelectorProps {
  onTierSelected: () => void;
}

export function TierSelector({ onTierSelected }: TierSelectorProps) {
  const { t } = useTranslations();
  const { tier, tiers, setTier } = useVaultStore();

  const handleTierSelect = (selectedTier: string) => {
    setTier(selectedTier as any);
    onTierSelected();
  };

  const getTierApr = (tierValue: string) => {
    if (!tiers?.tiers[tierValue]) return '0%';
    return `${tiers.tiers[tierValue].apr}%`;
  };

  return (
    <Card className="w-full bg-white/5 backdrop-blur-xl border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Lock className="h-5 w-5 text-blue-400" />
          {t('vault.tierSelection.title')}
        </CardTitle>
        <p className="text-white/70 text-sm">
          {t('vault.tierSelection.description')}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TIER_OPTIONS.map((option) => (
            <div
              key={option.value}
              className={`relative p-4 rounded-lg border transition-all cursor-pointer ${
                tier === option.value
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
              onClick={() => handleTierSelect(option.value)}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">{t(`vault.tierSelection.tierBenefits.${option.value}.title`)}</h3>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${option.color}`}
                  >
                    {t(`vault.tierSelection.tierBenefits.${option.value}.duration`)}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-white/70">
                    {t(`vault.tierSelection.tierBenefits.${option.value}.apr`)}: {getTierApr(option.value)}
                  </span>
                </div>
                
                <p className="text-xs text-white/60">
                  {t(`vault.tierSelection.tierBenefits.${option.value}.description`)}
                </p>
                
                {tier === option.value && (
                  <div className="absolute top-2 right-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400">
              {t('vault.tierSelection.selectTier')}
            </span>
          </div>
          <p className="text-xs text-white/70">
            {t('vault.tierSelection.tierDescription')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
