"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle, ExternalLink, Lock, Unlock, Coins, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type StakingStage = 
  | "idle"
  | "approving"
  | "approval-pending"
  | "approval-success"
  | "staking"
  | "staking-pending"
  | "staking-success"
  | "withdrawing"
  | "withdraw-pending"
  | "withdraw-success"
  | "error";

interface StakingModalProps {
  isOpen: boolean;
  onClose: () => void;
  stage: StakingStage;
  transactionHash?: string;
  error?: string;
  selectedCount: number;
  operation: "approve" | "stake" | "withdraw";
  collectionType: "seed" | "tree" | "solar" | "compute";
  chainId: string;
}

const STAGE_CONFIG = {
  idle: { progress: 0, title: "Ready", description: "Preparing transaction..." },
  approving: { progress: 20, title: "Approving NFTs", description: "Please approve the transaction in your wallet" },
  "approval-pending": { progress: 40, title: "Approval Pending", description: "Waiting for blockchain confirmation..." },
  "approval-success": { progress: 60, title: "Approval Confirmed", description: "NFTs are now approved for staking" },
  staking: { progress: 20, title: "Staking NFTs", description: "Please confirm the staking transaction" },
  "staking-pending": { progress: 60, title: "Staking Pending", description: "Waiting for blockchain confirmation..." },
  "staking-success": { progress: 100, title: "Staking Complete", description: "Your NFTs are now staked and earning rewards!" },
  withdrawing: { progress: 20, title: "Withdrawing NFTs", description: "Please confirm the withdrawal transaction" },
  "withdraw-pending": { progress: 60, title: "Withdrawal Pending", description: "Waiting for blockchain confirmation..." },
  "withdraw-success": { progress: 100, title: "Withdrawal Complete", description: "Your NFTs have been withdrawn successfully!" },
  error: { progress: 0, title: "Transaction Failed", description: "Something went wrong with the transaction" },
};

const COLLECTION_ICONS = {
  seed: "🌱",
  tree: "🌳",
  solar: "☀️",
  compute: "💻",
};

const COLLECTION_COLORS = {
  seed: "text-green-600",
  tree: "text-amber-600",
  solar: "text-yellow-600",
  compute: "text-blue-600",
};

export function StakingModal({
  isOpen,
  onClose,
  stage,
  transactionHash,
  error,
  selectedCount,
  operation,
  collectionType,
  chainId,
}: StakingModalProps) {
  const [isClosing, setIsClosing] = useState(false);

  const config = STAGE_CONFIG[stage];
  const isComplete = stage.includes("success");
  const isError = stage === "error";
  const isPending = stage.includes("pending");
  const isProcessing = stage.includes("approving") || stage.includes("staking") || stage.includes("withdrawing");

  const handleClose = () => {
    if (isProcessing || isPending) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  const getExplorerUrl = () => {
    const chainConfig = {
      "56": "https://bscscan.com",
      "137": "https://polygonscan.com",
      "42161": "https://arbiscan.io",
    };
    return `${chainConfig[chainId as keyof typeof chainConfig]}/tx/${transactionHash}`;
  };

  const getOperationIcon = () => {
    switch (operation) {
      case "approve":
        return <CheckCircle className="h-6 w-6" />;
      case "stake":
        return <Lock className="h-6 w-6" />;
      case "withdraw":
        return <Unlock className="h-6 w-6" />;
      default:
        return <Coins className="h-6 w-6" />;
    }
  };

  const getOperationText = () => {
    switch (operation) {
      case "approve":
        return "Approval";
      case "stake":
        return "Staking";
      case "withdraw":
        return "Withdrawal";
      default:
        return "Transaction";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span className="text-2xl">{COLLECTION_ICONS[collectionType]}</span>
            <span className={cn("capitalize", COLLECTION_COLORS[collectionType])}>
              {collectionType} {getOperationText()}
            </span>
          </DialogTitle>
          <DialogDescription>
            {selectedCount} {selectedCount === 1 ? "NFT" : "NFTs"} • {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{config.title}</span>
              <span className="text-sm text-muted-foreground">{config.progress}%</span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${config.progress}%` }}
              />
            </div>
            
            {/* Status Icon */}
            <div className="flex justify-center">
              <div className={cn(
                "p-4 rounded-full transition-colors",
                isError ? "bg-red-100 text-red-600" :
                isComplete ? "bg-green-100 text-green-600" :
                isPending ? "bg-blue-100 text-blue-600" :
                "bg-gray-100 text-gray-600"
              )}>
                {isError ? (
                  <XCircle className="h-8 w-8" />
                ) : isComplete ? (
                  <CheckCircle className="h-8 w-8" />
                ) : isPending ? (
                  <Clock className="h-8 w-8" />
                ) : (
                  <Loader2 className="h-8 w-8 animate-spin" />
                )}
              </div>
            </div>
          </div>

          {/* Transaction Hash */}
          {transactionHash && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Transaction Hash</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {transactionHash.slice(0, 8)}...{transactionHash.slice(-8)}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => window.open(getExplorerUrl(), "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View on Explorer
              </Button>
            </div>
          )}

          {/* Error Message */}
          {isError && error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {isComplete && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {operation === "stake" && "Your NFTs are now staked and earning rewards!"}
                {operation === "withdraw" && "Your NFTs have been withdrawn successfully!"}
                {operation === "approve" && "NFTs are now approved for staking operations!"}
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2">
            {isComplete && (
              <Button onClick={handleClose} className="flex-1">
                Done
              </Button>
            )}
            
            {isError && (
              <>
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Close
                </Button>
                <Button onClick={() => window.location.reload()} className="flex-1">
                  Try Again
                </Button>
              </>
            )}
            
            {(isProcessing || isPending) && (
              <Button variant="outline" onClick={handleClose} disabled className="flex-1">
                Processing...
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Rewards Summary Modal
interface RewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalRewards: number;
  collectionType: "seed" | "tree" | "solar" | "compute";
  stakedCount: number;
  dailyRate: number;
}

export function RewardsModal({
  isOpen,
  onClose,
  totalRewards,
  collectionType,
  stakedCount,
  dailyRate,
}: RewardsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Coins className="h-6 w-6 text-yellow-600" />
            <span>Rewards Summary</span>
          </DialogTitle>
          <DialogDescription>
            Your {collectionType} NFT staking rewards
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Total Rewards */}
          <div className="text-center space-y-2">
            <div className="text-4xl font-bold text-green-600">
              {totalRewards.toFixed(2)}
            </div>
            <div className="text-lg text-muted-foreground">rGGP Earned</div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{stakedCount}</div>
              <div className="text-sm text-muted-foreground">NFTs Staked</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{dailyRate}</div>
              <div className="text-sm text-muted-foreground">rGGP/Day</div>
            </div>
          </div>

          {/* Collection Info */}
          <div className="flex items-center justify-center space-x-2 p-4 bg-muted rounded-lg">
            <span className="text-2xl">{COLLECTION_ICONS[collectionType]}</span>
            <span className="capitalize font-medium">{collectionType} Collection</span>
          </div>

          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
