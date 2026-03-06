"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Activity,
  DollarSign,
  Users,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KOL {
  kolId: string;
  name: string;
  walletAddress: string;
  email?: string | null;
  target?: number;
  seed?: number;
  tree?: number;
  solar?: number;
  compute?: number;
  updatedAt?: any;
}

interface MintEventItem {
  address: string;
  nftType: "seed" | "tree" | "solar" | "compute";
  quantity: number;
  chainId: string;
  txHash?: string | null;
  timestamp: any;
  mintType?: "public" | "agent";
  kolId?: string;
}

interface PerformanceChartsProps {
  kols: KOL[];
  mintEvents: MintEventItem[];
  className?: string;
}

const NFT_PRICES = { seed: 29, tree: 59, solar: 299, compute: 899 } as const;

export function PerformanceCharts({ kols, mintEvents, className }: PerformanceChartsProps) {
  // Calculate performance metrics
  const performanceData = React.useMemo(() => {
    if (!kols || !Array.isArray(kols) || !mintEvents || !Array.isArray(mintEvents)) {
      return {
        nftTypeDistribution: { seed: 0, tree: 0, solar: 0, compute: 0 },
        chainDistribution: {},
        dailyActivity: [],
        topKOLs: []
      };
    }
    
    // NFT type distribution
    const nftTypeDistribution = kols.reduce((acc, kol) => {
      acc.seed += Number(kol.seed ?? 0);
      acc.tree += Number(kol.tree ?? 0);
      acc.solar += Number(kol.solar ?? 0);
      acc.compute += Number(kol.compute ?? 0);
      return acc;
    }, { seed: 0, tree: 0, solar: 0, compute: 0 });

    // Chain distribution from events
    const chainDistribution = mintEvents.reduce((acc, event) => {
      acc[event.chainId] = (acc[event.chainId] || 0) + event.quantity;
      return acc;
    }, {} as Record<string, number>);

    // Daily activity (last 7 days)
    const days = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayEvents = mintEvents.filter(event => {
        const eventDate = event.timestamp?.toDate?.() || new Date(event.timestamp);
        return eventDate >= dayStart && eventDate <= dayEnd;
      });
      
      days.push({
        date: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        mints: dayEvents.reduce((sum, event) => sum + event.quantity, 0),
        value: dayEvents.reduce((sum, event) => sum + (event.quantity * NFT_PRICES[event.nftType]), 0),
        events: dayEvents.length
      });
    }
    
    const dailyActivity = days;

    // Top performing KOLs
    const topKOLs = kols
      .map(kol => {
        const seed = Number(kol.seed ?? 0);
        const tree = Number(kol.tree ?? 0);
        const solar = Number(kol.solar ?? 0);
        const compute = Number(kol.compute ?? 0);
        
        const totalMints = seed + tree + solar + compute;
        const totalValue = 
          seed * NFT_PRICES.seed +
          tree * NFT_PRICES.tree +
          solar * NFT_PRICES.solar +
          compute * NFT_PRICES.compute;
        
        return {
          ...kol,
          totalMints,
          totalValue
        };
      })
      .sort((a, b) => b.totalMints - a.totalMints)
      .slice(0, 5);

    return {
      nftTypeDistribution,
      chainDistribution,
      dailyActivity,
      topKOLs
    };
  }, [kols, mintEvents]);

  const maxDailyMints = Math.max(...performanceData.dailyActivity.map(d => d.mints), 1);
  const maxDailyValue = Math.max(...performanceData.dailyActivity.map(d => d.value), 1);

  return (
    <div className={cn("space-y-6", className)}>
      {/* NFT Type Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            <span>NFT Type Distribution</span>
          </CardTitle>
          <CardDescription>
            Breakdown of minted NFTs by type across all KOLs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(performanceData.nftTypeDistribution).map(([type, count]) => {
              const total = Object.values(performanceData.nftTypeDistribution).reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? (count / total) * 100 : 0;
              const value = count * NFT_PRICES[type as keyof typeof NFT_PRICES];
              
              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        type === "seed" && "bg-blue-500",
                        type === "tree" && "bg-green-500",
                        type === "solar" && "bg-yellow-500",
                        type === "compute" && "bg-purple-500"
                      )} />
                      <span className="font-medium capitalize">{type}Pass</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${value.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">{percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={cn(
                        "h-2 rounded-full transition-all duration-500",
                        type === "seed" && "bg-blue-500",
                        type === "tree" && "bg-green-500",
                        type === "solar" && "bg-yellow-500",
                        type === "compute" && "bg-purple-500"
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Daily Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-green-500" />
            <span>7-Day Activity</span>
          </CardTitle>
          <CardDescription>
            Daily minting activity over the past week
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-7 gap-2">
              {performanceData.dailyActivity.map((day, index) => (
                <div key={day.date} className="text-center space-y-2">
                  <div className="text-xs text-muted-foreground">{day.label}</div>
                  <div className="space-y-1">
                    <div
                      className="bg-primary rounded-sm transition-all duration-500"
                      style={{ 
                        height: `${Math.max((day.mints / maxDailyMints) * 60, 4)}px`,
                        minHeight: '4px'
                      }}
                      title={`${day.mints} mints`}
                    />
                    <div
                      className="bg-green-500 rounded-sm transition-all duration-500"
                      style={{ 
                        height: `${Math.max((day.value / maxDailyValue) * 40, 2)}px`,
                        minHeight: '2px'
                      }}
                      title={`$${day.value.toLocaleString()}`}
                    />
                  </div>
                  <div className="text-xs">
                    <div className="font-medium">{day.mints}</div>
                    <div className="text-muted-foreground">${(day.value / 1000).toFixed(0)}k</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Performing KOLs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-purple-500" />
            <span>Top Performers</span>
          </CardTitle>
          <CardDescription>
            KOLs with the highest minting activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {performanceData.topKOLs.map((kol, index) => (
              <div key={kol.kolId} className="flex items-center space-x-3 p-3 rounded-lg border">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">#{index + 1}</span>
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{kol.name}</div>
                  <div className="text-sm text-muted-foreground truncate">{kol.kolId}</div>
                </div>
                
                <div className="flex items-center space-x-4 text-sm">
                  <div className="text-right">
                    <div className="font-semibold text-primary">{kol.totalMints}</div>
                    <div className="text-xs text-muted-foreground">Mints</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">${kol.totalValue.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Value</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chain Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <span>Network Distribution</span>
          </CardTitle>
          <CardDescription>
            Minting activity across different blockchain networks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(performanceData.chainDistribution).map(([chainId, count]) => {
              const chainName = chainId === "56" ? "BSC" : chainId === "137" ? "Polygon" : chainId === "42161" ? "Arbitrum" : chainId;
              const total = Object.values(performanceData.chainDistribution).reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? (count / total) * 100 : 0;
              
              return (
                <div key={chainId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{chainName}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{percentage.toFixed(1)}%</div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="h-2 bg-yellow-500 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
