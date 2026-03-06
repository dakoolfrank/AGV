'use client';

import { useVaultStore } from '@/lib/vault/store';
import { useRealtimeLeaderboard } from '@/lib/vault/useRealtimeLeaderboard';
import { formatNumber, formatLargeNumber, formatWalletAddress } from '@/lib/vault/math';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Medal, Award, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';

const rankIcons = {
  1: Trophy,
  2: Medal,
  3: Award
};

const rankColors = {
  1: 'text-yellow-500',
  2: 'text-gray-400',
  3: 'text-amber-600'
};

export function Leaderboard() {
  const { t } = useTranslations();
  const { isLoading } = useVaultStore();
  const { leaderboard, isUpdating, refreshNow, lastUpdate } = useRealtimeLeaderboard();

  if (isLoading) {
    return (
      <Card className="w-full bg-white/5 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Trophy className="h-5 w-5 text-yellow-400" />
            {t('vault.leaderboard.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 bg-white/20 rounded"></div>
                  <div className="h-4 bg-white/20 rounded w-32"></div>
                </div>
                <div className="h-4 bg-white/20 rounded w-20"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!leaderboard || leaderboard.rows.length === 0) {
    return (
      <Card className="w-full bg-white/5 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Trophy className="h-5 w-5 text-yellow-400" />
            {t('vault.leaderboard.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-yellow-500/20">
                <Trophy className="h-12 w-12 text-yellow-400" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-white">{t('vault.leaderboard.loading')}</h3>
              <p className="text-white/70 mb-4">
                {t('vault.leaderboard.noData')}
              </p>
              <Button onClick={refreshNow} variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('vault.refresh.refresh')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const topRows = leaderboard.rows.slice(0, 100);
  const lastUpdated = lastUpdate > 0 ? new Date(lastUpdate) : new Date(leaderboard.asOf * 1000);

  return (
    <Card className="w-full bg-white/5 backdrop-blur-xl border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" />
            <span className="text-white">{t('vault.leaderboard.title')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshNow}
              disabled={isUpdating}
              className="h-8 w-8 p-0 text-white hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
            </Button>
            <div className="flex items-center gap-1">
              {isUpdating ? (
                <Wifi className="h-3 w-3 text-blue-400 animate-pulse" />
              ) : (
                <Wifi className="h-3 w-3 text-green-400" />
              )}
              <Badge variant="outline" className="text-xs bg-white/10 border-white/20 text-white">
                {isUpdating ? t('vault.refresh.updating') : `${t('vault.leaderboard.updated')} ${lastUpdated.toLocaleTimeString()}`}
              </Badge>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {topRows.map((row, index) => {
            const Icon = rankIcons[row.rank as keyof typeof rankIcons];
            const colorClass = rankColors[row.rank as keyof typeof rankColors];
            
            return (
              <div
                key={row.wallet}
                className={`flex items-center justify-between p-3 rounded-lg transition-all duration-300 border ${
                  row.rank <= 3 
                    ? 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/20' 
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                } ${isUpdating ? 'animate-pulse' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8">
                    {Icon ? (
                      <Icon className={`h-5 w-5 ${colorClass}`} />
                    ) : (
                      <span className={`text-sm font-semibold ${row.rank <= 10 ? 'text-white' : 'text-white/70'}`}>
                        {row.rank}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-sm text-white">
                    {formatWalletAddress(row.wallet)}
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-green-400">
                      {formatNumber(row.rggp, 2)} rGGP
                    </div>
                    <div className="text-xs text-white/60">
                      {formatLargeNumber(row.xp)} XP
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="text-center mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-center gap-2">
            {isUpdating ? (
              <>
                <Wifi className="h-3 w-3 text-blue-400 animate-pulse" />
                <p className="text-sm text-blue-400">
                  {t('vault.refresh.updatingLeaderboard')}
                </p>
              </>
            ) : (
              <>
                <Wifi className="h-3 w-3 text-green-400" />
                <p className="text-sm text-white/60">
                  {t('vault.leaderboard.realTimeActive')}
                </p>
              </>
            )}
          </div>
          {topRows.length === 100 && (
            <p className="text-xs text-white/50 mt-1">
              {t('vault.leaderboard.showingTop100')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
