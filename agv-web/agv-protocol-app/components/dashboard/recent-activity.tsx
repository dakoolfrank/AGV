"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Activity, 
  Clock, 
  ExternalLink, 
  Zap,
  TrendingUp,
  Users,
  DollarSign,
  Globe
} from "lucide-react";
import { cn } from "@/lib/utils";

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

interface RecentActivityProps {
  mintEvents: MintEventItem[];
  kols: Array<{
    kolId: string;
    name: string;
    walletAddress: string;
  }>;
  className?: string;
}

const NFT_PRICES = { seed: 29, tree: 59, solar: 299, compute: 899 } as const;
const CHAIN_NAMES = {
  "56": "BSC",
  "137": "Polygon", 
  "42161": "Arbitrum"
} as const;

export function RecentActivity({ mintEvents, kols, className }: RecentActivityProps) {
  // Get recent events (last 20)
  const recentEvents = React.useMemo(() => {
    if (!mintEvents || !Array.isArray(mintEvents)) return [];
    
    return mintEvents
      .sort((a, b) => {
        const timeA = a.timestamp?.toDate?.() || new Date(a.timestamp);
        const timeB = b.timestamp?.toDate?.() || new Date(b.timestamp);
        return timeB.getTime() - timeA.getTime();
      })
      .slice(0, 20);
  }, [mintEvents]);

  // Create KOL lookup map
  const kolMap = React.useMemo(() => {
    if (!kols || !Array.isArray(kols)) return {};
    
    return kols.reduce((acc, kol) => {
      if (kol && kol.kolId) {
        acc[kol.kolId] = kol;
      }
      return acc;
    }, {} as Record<string, typeof kols[0]>);
  }, [kols]);

  const formatTimeAgo = (timestamp: any) => {
    const date = timestamp?.toDate?.() || new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const getNFTTypeColor = (nftType: string) => {
    switch (nftType) {
      case "seed":
        return "bg-blue-500";
      case "tree":
        return "bg-green-500";
      case "solar":
        return "bg-yellow-500";
      case "compute":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  const getNFTTypeName = (nftType: string) => {
    switch (nftType) {
      case "seed":
        return "SeedPass";
      case "tree":
        return "TreePass";
      case "solar":
        return "SolarPass";
      case "compute":
        return "ComputePass";
      default:
        return nftType;
    }
  };

  const getChainIcon = (chainId: string) => {
    switch (chainId) {
      case "56":
        return "🟡"; // BSC
      case "137":
        return "🟣"; // Polygon
      case "42161":
        return "🔵"; // Arbitrum
      default:
        return "⛓️";
    }
  };

  return (
    <Card className={cn("w-full overflow-hidden", className)}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-blue-500" />
          <span>Recent Activity</span>
        </CardTitle>
        <CardDescription>
          Latest NFT minting activity across all KOLs and networks
        </CardDescription>
      </CardHeader>
      <CardContent className="w-full overflow-hidden">
        <div className="space-y-3 w-full">
          {recentEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recent activity</p>
              <p className="text-sm">Minting activity will appear here in real-time</p>
            </div>
          ) : (
            recentEvents.map((event, index) => {
              const kol = event.kolId ? kolMap[event.kolId] : null;
              const totalValue = event.quantity * NFT_PRICES[event.nftType];
              
              return (
                <div
                  key={`${event.txHash}-${index}`}
                  className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors w-full min-w-0"
                >
                  {/* Top row - NFT Type, Avatar, and KOL Info */}
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {/* NFT Type Indicator */}
                    <div className="flex-shrink-0">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        getNFTTypeColor(event.nftType)
                      )} />
                    </div>

                    {/* KOL Avatar */}
                    <Avatar className="h-8 w-8">
                      <AvatarImage 
                        src={kol ? `https://api.dicebear.com/7.x/initials/svg?seed=${kol.name}` : undefined} 
                      />
                      <AvatarFallback className="text-xs">
                        {kol ? kol.name.charAt(0).toUpperCase() : "?"}
                      </AvatarFallback>
                    </Avatar>

                    {/* Activity Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="text-sm font-medium truncate">
                          {kol ? kol.name : "Unknown KOL"}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {getNFTTypeName(event.nftType)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        <span className="whitespace-nowrap">Minted {event.quantity}x</span>
                        <span>•</span>
                        <span className="whitespace-nowrap">${totalValue.toLocaleString()}</span>
                        <span>•</span>
                        <span className="flex items-center space-x-1 whitespace-nowrap">
                          <span>{getChainIcon(event.chainId)}</span>
                          <span>{CHAIN_NAMES[event.chainId as keyof typeof CHAIN_NAMES] || event.chainId}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom row - Time and Actions */}
                  <div className="flex items-center justify-between sm:justify-end sm:space-x-2">
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-muted-foreground flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatTimeAgo(event.timestamp)}</span>
                      </div>
                    </div>
                    
                    {event.txHash && (
                      <button
                        onClick={() => {
                          const explorer = event.chainId === "56" 
                            ? "https://bscscan.com" 
                            : event.chainId === "137"
                            ? "https://polygonscan.com"
                            : "https://arbiscan.io";
                          window.open(`${explorer}/tx/${event.txHash}`, "_blank");
                        }}
                        className="p-1 hover:bg-muted rounded transition-colors"
                        title="View transaction"
                      >
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Activity Summary */}
        {recentEvents.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-lg font-bold text-primary">
                  {recentEvents.length}
                </div>
                <div className="text-xs text-muted-foreground">Recent Events</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">
                  {recentEvents.reduce((sum, event) => sum + event.quantity, 0)}
                </div>
                <div className="text-xs text-muted-foreground">NFTs Minted</div>
              </div>
              <div>
                <div className="text-lg font-bold text-blue-600">
                  ${recentEvents.reduce((sum, event) => 
                    sum + (event.quantity * NFT_PRICES[event.nftType]), 0
                  ).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Total Value</div>
              </div>
              <div>
                <div className="text-lg font-bold text-purple-600">
                  {new Set(recentEvents.map(e => e.kolId).filter(Boolean)).size}
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
