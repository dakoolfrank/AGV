'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, CheckCircle, XCircle, StarIcon } from "lucide-react";
import { usePassOwnership, PASS_TYPES } from "@/hooks/usePassOwnership";
import { toast } from "sonner";

interface PassOwnershipDisplayProps {
  className?: string;
}

export function PassOwnershipDisplay({ className }: PassOwnershipDisplayProps) {
  const { 
    ownership, 
    isLoading, 
    error, 
    hasPass, 
    availablePasses,
    fetchOwnership 
  } = usePassOwnership();

  const handleRefresh = async () => {
    try {
      await fetchOwnership();
      toast.success("Pass ownership refreshed");
    } catch (err) {
      toast.error("Failed to refresh pass ownership");
    }
  };

  const openExplorer = (contractAddress: string) => {
    window.open(`https://bscscan.com/address/${contractAddress}`, '_blank');
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Pass Ownership
          </CardTitle>
          <CardDescription>
            Checking your pass holdings...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Pass Ownership
          </CardTitle>
          <CardDescription>
            Error checking pass ownership
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasPass) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-amber-500" />
            No Pass Found
          </CardTitle>
          <CardDescription>
            No eligible passes found in your wallet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-4">
              You don't own any eligible passes. Please acquire a pass to participate in PreGVT.
            </p>
            <div className="space-y-2 mb-4">
              <h4 className="font-semibold text-sm">Available Pass Types:</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {PASS_TYPES.map((pass) => (
                  <div key={pass.id} className="bg-gray-50 p-2 rounded border">
                    <div className="font-medium">{pass.name}</div>
                    <div className="text-gray-600">{pass.preGVTAmount} preGVT</div>
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              {ownership?.passType.name} Pass
            </CardTitle>
            <CardDescription>
              Your pass ownership and rewards
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default">
              Owned
            </Badge>
            <Button onClick={handleRefresh} variant="ghost" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {ownership && (
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {ownership.passType.name}
                  </Badge>
                  <Badge variant="secondary">
                    BSC
                  </Badge>
                  <Badge variant="default">
                    {ownership.balance} Pass{ownership.balance !== 1 ? 'es' : ''}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openExplorer(ownership.contractAddress)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                Contract: {ownership.contractAddress.slice(0, 6)}...{ownership.contractAddress.slice(-4)}
              </div>
              {ownership.tokenIds.length > 0 && (
                <div className="text-sm text-muted-foreground mt-1">
                  Token IDs: {ownership.tokenIds.join(', ')}
                </div>
              )}
            </div>

            {/* Rewards Information */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800 mb-2">
                <StarIcon className="h-4 w-4" />
                <span className="font-medium">Activation Rewards</span>
              </div>
              <div className="text-2xl font-bold text-green-700 mb-1">
                {ownership.passType.preGVTAmount.toLocaleString()} preGVT
              </div>
              <p className="text-sm text-green-600">
                One-time activation bonus for {ownership.passType.name} holders
              </p>
            </div>

            {/* Additional passes if user owns multiple */}
            {availablePasses.length > 1 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-blue-800 mb-2">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium text-sm">Additional Passes</span>
                </div>
                <div className="text-sm text-blue-700">
                  You own {availablePasses.length} different passes. Using the highest value: {ownership.passType.name}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
