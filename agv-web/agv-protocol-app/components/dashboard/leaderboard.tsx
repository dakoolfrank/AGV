"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Trophy, 
  Medal, 
  Award, 
  TrendingUp, 
  Users, 
  Crown,
  Star,
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

interface LeaderboardProps {
  kols: KOL[];
  className?: string;
}

const NFT_PRICES = { seed: 29, tree: 59, solar: 299, compute: 899 } as const;

export function Leaderboard({ kols, className }: LeaderboardProps) {
  // Calculate KOL performance metrics
  const kolPerformance = React.useMemo(() => {
    if (!kols || !Array.isArray(kols)) return [];
    
    return kols.map(kol => {
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
      
      const target = Number(kol.target ?? 0);
      const completionRate = target > 0 ? (totalMints / target) * 100 : 0;
      
      return {
        ...kol,
        totalMints,
        totalValue,
        completionRate,
        performanceScore: totalMints * 10 + totalValue / 100 // Combined scoring
      };
    }).sort((a, b) => b.performanceScore - a.performanceScore);
  }, [kols]);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="h-5 w-5 text-yellow-500" />;
      case 1:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 2:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>;
    }
  };

  const getRankBadge = (index: number) => {
    switch (index) {
      case 0:
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-xs px-2 py-0.5">🥇 #1</Badge>;
      case 1:
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20 text-xs px-2 py-0.5">🥈 #2</Badge>;
      case 2:
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs px-2 py-0.5">🥉 #3</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs px-2 py-0.5">#{index + 1}</Badge>;
    }
  };

  const topPerformers = kolPerformance.slice(0, 10);

  return (
    <Card className={cn("h-fit w-full overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center space-x-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span>KOL Leaderboard</span>
        </CardTitle>
        <CardDescription className="text-sm">
          Top performing KOLs ranked by performance
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 w-full overflow-hidden">
        <div className="space-y-3 w-full">
          {topPerformers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No KOLs found</p>
              <p className="text-sm">KOLs will appear here once they start minting NFTs</p>
            </div>
          ) : (
            topPerformers.map((kol, index) => (
              <div
                key={kol.kolId}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 p-3 rounded-lg border transition-all duration-200 w-full min-w-0",
                  "hover:bg-muted/50 hover:shadow-sm",
                  {
                    "bg-gradient-to-r from-yellow-50 to-yellow-100/50 border-yellow-200 shadow-sm": index === 0,
                    "bg-gradient-to-r from-gray-50 to-gray-100/50 border-gray-200": index === 1,
                    "bg-gradient-to-r from-amber-50 to-amber-100/50 border-amber-200": index === 2,
                    "bg-background border-border": index > 2,
                  }
                )}
              >
                {/* Top row - Rank, Avatar, and KOL Info */}
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {/* Rank */}
                  <div className="flex-shrink-0 w-6">
                    {getRankIcon(index)}
                  </div>

                  {/* Avatar */}
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${kol.name}`} />
                    <AvatarFallback className="text-xs">
                      {kol.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* KOL Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-sm truncate">{kol.name}</h3>
                      {index < 3 && (
                        <div className="flex-shrink-0">
                          {getRankBadge(index)}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {kol.kolId}
                    </p>
                  </div>
                </div>

                {/* Bottom row - Performance Metrics */}
                <div className="flex items-center justify-between sm:justify-end sm:space-x-4">
                  <div className="text-left sm:text-right">
                    <div className="font-semibold text-primary text-sm">
                      {kol.totalMints} mints
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ${kol.totalValue.toLocaleString()} value
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary Stats */}
        {topPerformers.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-bold text-primary">
                  {topPerformers.reduce((sum, kol) => sum + kol.totalMints, 0)}
                </div>
                <div className="text-xs text-muted-foreground">Total Mints</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">
                  ${topPerformers.reduce((sum, kol) => sum + kol.totalValue, 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Total Value</div>
              </div>
              <div>
                <div className="text-lg font-bold text-blue-600">
                  {topPerformers.length}
                </div>
                <div className="text-xs text-muted-foreground">Active KOLs</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
