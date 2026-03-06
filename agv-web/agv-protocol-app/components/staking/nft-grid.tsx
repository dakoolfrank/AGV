// components/NFTGrid.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Lock, Unlock, Clock, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

interface NFT {
  tokenId: string;
  stakedAt?: number;
  rewards?: number;
  imageUrl?: string; // optional – we don't dereference nested url
  name?: string;
}

interface NFTGridProps {
  nfts: NFT[];
  selectedIds: string[];
  onSelectionChange: (tokenId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  isStaked?: boolean;
  collectionType: "seed" | "tree" | "solar" | "compute";
  className?: string;
}

const COLLECTION_COLORS = {
  seed: "from-green-500 to-emerald-600",
  tree: "from-amber-500 to-orange-600",
  solar: "from-yellow-500 to-amber-600",
  compute: "from-blue-500 to-purple-600",
};

const COLLECTION_ICONS = {
  seed: "🌱",
  tree: "🌳",
  solar: "☀️",
  compute: "💻",
};

export function NFTGrid({
  nfts,
  selectedIds,
  onSelectionChange,
  onSelectAll,
  onDeselectAll,
  isStaked = false,
  collectionType,
  className,
}: NFTGridProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const allSelected = nfts.length > 0 && selectedIds.length === nfts.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < nfts.length;

  const formatStakeTime = (stakedAt: number) => {
    const now = Date.now();
    const diffMs = now - stakedAt;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h`;
    }
    return `${diffHours}h`;
  };

  const formatRewards = (rewards: number) => {
    return rewards.toFixed(2);
  };

  if (nfts.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="text-6xl mb-4 opacity-50">{isStaked ? "🔒" : "🎨"}</div>
          <h3 className="text-lg font-semibold mb-2">
            {isStaked ? "No Staked NFTs" : "No NFTs Found"}
          </h3>
          <p className="text-muted-foreground text-center">
            {isStaked
              ? "You haven't staked any NFTs yet. Stake some NFTs to start earning rewards!"
              : "No NFTs found in your wallet for this collection."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{COLLECTION_ICONS[collectionType]}</span>
            <div>
              <h3 className="text-lg font-semibold capitalize">
                {isStaked ? "Staked" : "Owned"} {collectionType} NFTs
              </h3>
              <p className="text-sm text-muted-foreground">
                {nfts.length} {nfts.length === 1 ? "NFT" : "NFTs"} • {selectedIds.length} selected
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Select All Controls */}
            <div className="flex items-center space-x-1">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) (el as any).indeterminate = someSelected;
                }}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onSelectAll();
                  } else {
                    onDeselectAll();
                  }
                }}
              />
              <span className="text-sm text-muted-foreground">
                {allSelected ? "Deselect All" : "Select All"}
              </span>
            </div>

            {/* View Mode Toggle */}
            <div className="flex border rounded-lg">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="rounded-r-none"
              >
                Grid
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="rounded-l-none"
              >
                List
              </Button>
            </div>
          </div>
        </div>

        {/* NFT Grid/List */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {nfts.map((nft) => (
              <Card
                key={nft.tokenId}
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:shadow-md",
                  selectedIds.includes(nft.tokenId) && "ring-2 ring-primary shadow-md"
                )}
                onClick={() => onSelectionChange(nft.tokenId)}
              >
                <CardContent className="p-4">
                  {/* Placeholder image (no nested .url access) */}
                  <div
                    className={cn(
                      "w-full h-32 rounded-lg mb-3 bg-gradient-to-br flex items-center justify-center text-white font-bold text-2xl",
                      COLLECTION_COLORS[collectionType]
                    )}
                  >
                    {COLLECTION_ICONS[collectionType]}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">#{nft.tokenId}</span>
                      <Checkbox checked={selectedIds.includes(nft.tokenId)} onChange={() => {}} />
                    </div>

                    {isStaked && nft.stakedAt && (
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Staked {formatStakeTime(nft.stakedAt)}</span>
                        </div>
                        {typeof nft.rewards === "number" && (
                          <div className="flex items-center space-x-1 text-xs text-green-600">
                            <Coins className="h-3 w-3" />
                            <span>{formatRewards(nft.rewards)} rGGP</span>
                          </div>
                        )}
                      </div>
                    )}

                    <Badge variant={isStaked ? "secondary" : "outline"} className="w-full justify-center">
                      {isStaked ? (
                        <>
                          <Lock className="h-3 w-3 mr-1" />
                          Staked
                        </>
                      ) : (
                        <>
                          <Unlock className="h-3 w-3 mr-1" />
                          Available
                        </>
                      )}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {nfts.map((nft) => (
              <Card
                key={nft.tokenId}
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:shadow-md",
                  selectedIds.includes(nft.tokenId) && "ring-2 ring-primary shadow-md"
                )}
                onClick={() => onSelectionChange(nft.tokenId)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg",
                          COLLECTION_COLORS[collectionType]
                        )}
                      >
                        {COLLECTION_ICONS[collectionType]}
                      </div>

                      <div>
                        <div className="font-semibold">#{nft.tokenId}</div>
                        {isStaked && nft.stakedAt && (
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatStakeTime(nft.stakedAt)}</span>
                            </div>
                            {typeof nft.rewards === "number" && (
                              <div className="flex items-center space-x-1 text-green-600">
                                <Coins className="h-3 w-3" />
                                <span>{formatRewards(nft.rewards)} rGGP</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Badge variant={isStaked ? "secondary" : "outline"}>
                        {isStaked ? (
                          <>
                            <Lock className="h-3 w-3 mr-1" />
                            Staked
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3 w-3 mr-1" />
                            Available
                          </>
                        )}
                      </Badge>
                      <Checkbox checked={selectedIds.includes(nft.tokenId)} onChange={() => {}} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
