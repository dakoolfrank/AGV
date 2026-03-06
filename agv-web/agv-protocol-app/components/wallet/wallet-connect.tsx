"use client";

import { useState } from "react";
import { Wallet, LogOut, Copy, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { ConnectButton, useActiveAccount, useDisconnect } from "thirdweb/react";
import { toast } from "sonner";
import { createThirdwebClient } from "thirdweb";

const CHAINS = {
  "0x38": { name: "BSC", symbol: "BNB", explorer: "https://bscscan.com" },
  "0x89": { name: "Polygon", symbol: "MATIC", explorer: "https://polygonscan.com" },
  "0xa4b1": { name: "Arbitrum", symbol: "ETH", explorer: "https://arbiscan.io" },
} as const;
export const thirdwebClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});
export function WalletConnect() {
  return <ConnectButton client={thirdwebClient} />
}

export function WalletStatus() {
  const account = useActiveAccount();

  if (!account) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">Wallet Not Connected</p>
              <p className="text-sm text-amber-700">
                Connect your wallet to start minting NFTs
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chainId = account.chain?.id.toString(16);
  const currentChain = chainId ? CHAINS[`0x${chainId}` as keyof typeof CHAINS] : null;

  return (
    <Card className="border-green-200 bg-green-50">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <div>
            <p className="font-medium text-green-800">Wallet Connected</p>
            <p className="text-sm text-green-700">
              {account.address?.slice(0, 6)}...{account.address?.slice(-4)} on {currentChain?.name}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
