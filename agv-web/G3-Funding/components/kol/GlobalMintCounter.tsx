'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import { useTranslations } from '@/app/[locale]/TranslationProvider';

interface MintCounterData {
  campaign: string;
  totalMints: number;
  totalValue: number;
  last7Days: Array<{
    date: string;
    mints: number;
    value: number;
  }>;
  updatedAt: string;
}

interface GlobalMintCounterProps {
  campaign?: string;
  className?: string;
}

export function GlobalMintCounter({ campaign = 'G3', className = '' }: GlobalMintCounterProps) {
  const t = useTranslations('globalMintCounter');
  const [data, setData] = useState<MintCounterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/counter?campaign=${campaign}`);
        if (!response.ok) throw new Error('Failed to fetch counter data');
        
        const counterData = await response.json();
        setData(counterData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [campaign]);
  
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  const getSparklineData = () => {
    if (!data?.last7Days) return [];
    
    // Sort by date and get last 7 days
    const sortedDays = [...data.last7Days]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7);
    
    const maxMints = Math.max(...sortedDays.map(d => d.mints));
    
    return sortedDays.map(day => ({
      ...day,
      normalizedHeight: maxMints > 0 ? (day.mints / maxMints) * 100 : 0
    }));
  };
  
  const sparklineData = getSparklineData();
  const last7DaysMints = data?.last7Days.reduce((sum, day) => sum + day.mints, 0) || 0;
  const last7DaysValue = data?.last7Days.reduce((sum, day) => sum + day.value, 0) || 0;
  
  if (loading) {
    return (
      <Card className={`animate-pulse ${className}`}>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card className={`border-red-200 ${className}`}>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <Activity className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">{t('unableToLoad')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={`border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-primary flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>{t('title')}</span>
            </CardTitle>
            <CardDescription className="text-primary/70">
              {t('description')}
            </CardDescription>
          </div>
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Main Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-primary/70">{t('totalMints')}</span>
              </div>
              <p className="text-2xl font-bold text-primary">{formatNumber(data?.totalMints || 0)}</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-primary/70">{t('totalValue')}</span>
              </div>
              <p className="text-2xl font-bold text-primary">{formatCurrency(data?.totalValue || 0)}</p>
            </div>
          </div>
          
          {/* 7-Day Sparkline */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-primary/70">{t('last7Days')}</span>
              <span className="text-xs text-primary/60">
                {formatNumber(last7DaysMints)} {t('mints')} • {formatCurrency(last7DaysValue)}
              </span>
            </div>
            
            <div className="flex items-end space-x-1 h-12 bg-white/50 rounded p-2">
              {sparklineData.length > 0 ? (
                sparklineData.map((day) => (
                  <div
                    key={day.date}
                    className="flex-1 bg-primary/60 rounded-sm min-w-[4px] relative group cursor-pointer"
                    style={{ height: `${Math.max(day.normalizedHeight, 5)}%` }}
                    title={`${day.date}: ${day.mints} mints`}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      <br />
                      {day.mints} {t('mints')}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex-1 text-center text-xs text-primary/50 py-4">
                  {t('noDataAvailable')}
                </div>
              )}
            </div>
          </div>
          
          {/* Last Updated */}
          <div className="text-center">
            <p className="text-xs text-primary/50">
              {t('lastUpdated')}: {data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : t('unknown')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
