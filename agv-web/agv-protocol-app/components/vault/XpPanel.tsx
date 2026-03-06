'use client';

import { useVaultStore } from '@/lib/vault/store';
import { formatNumber, formatLargeNumber } from '@/lib/vault/math';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, RefreshCw, AlertTriangle, Target } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';

export function XpPanel() {
  const { t } = useTranslations();
  const { xp, isLoading, refreshData } = useVaultStore();

  if (isLoading) {
  return (
    <Card className="w-full bg-white/5 backdrop-blur-xl border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <div className="h-5 w-5 bg-white/20 rounded animate-pulse"></div>
          {t('vault.xpPanel.title')}
        </CardTitle>
      </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-white/10 rounded"></div>
            <div className="h-4 bg-white/10 rounded w-3/4"></div>
            <div className="h-8 bg-white/10 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!xp) {
    return (
      <Card className="w-full bg-white/5 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <div className="h-5 w-5 bg-white/20 rounded"></div>
            {t('vault.xpPanel.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-purple-500/20">
                <Target className="h-12 w-12 text-purple-400" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-white">{t('vault.xpPanel.noXpData')}</h3>
              <p className="text-white/70 mb-4">
                {t('vault.xpPanel.noXpDescription')}
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" asChild className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  <a href="https://zealy.io" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Zealy
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  <a href="https://taskon.xyz" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    TaskOn
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isStale = xp.asOf ? (Date.now() / 1000 - xp.asOf) > 7200 : false; // 2 hours
  const lastUpdated = xp.asOf ? new Date(xp.asOf * 1000) : null;

  return (
    <Card className="w-full bg-white/5 backdrop-blur-xl border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 bg-gradient-to-r from-purple-500 to-pink-500 rounded"></div>
            <span className="text-white">{t('vault.xpPanel.title')}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshData}
            className="h-8 w-8 p-0 text-white hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* XP Display */}
        <div className="text-center">
          <div className="text-4xl font-bold text-purple-400 mb-2">
            {formatLargeNumber(xp.xp)}
          </div>
          <div className="text-sm text-white/70">
            {t('vault.xpPanel.currentXp')}
          </div>
        </div>

        {/* XP Status */}
        <div className="flex items-center justify-center gap-2">
          <Badge 
            variant={isStale ? "destructive" : "secondary"}
            className={isStale ? "bg-orange-500/20 text-orange-400 border-orange-500/20" : "bg-white/10 border-white/20 text-white"}
          >
            {isStale ? (
              <>
                <AlertTriangle className="h-3 w-3 mr-1" />
                {t('vault.xpPanel.updatePending')}
              </>
            ) : (
              t('vault.xpPanel.upToDate')
            )}
          </Badge>
        </div>

        {/* Last Updated */}
        {lastUpdated && (
          <div className="text-center text-sm text-white/60">
            {t('vault.xpPanel.lastUpdate')}: {lastUpdated.toLocaleString()}
          </div>
        )}

        {/* XP Boost Info */}
        <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
          <div className="text-center">
            <div className="text-lg font-semibold text-purple-400 mb-1">
              {t('vault.xpPanel.xpBoostActive')}
            </div>
            <div className="text-sm text-white/70">
              {t('vault.xpPanel.xpBoostDescription')}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-col">
          <Button variant="outline" size="sm" className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20 p-1" asChild>
            <a href="https://zealy.io" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              {t('vault.xpPanel.zealy')}
            </a>
          </Button>
          <Button variant="outline" size="sm" className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20 p-1" asChild>
            <a href="https://taskon.xyz" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              {t('vault.xpPanel.taskon')}
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
