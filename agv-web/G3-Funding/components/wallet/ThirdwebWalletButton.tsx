'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Copy, Check, ExternalLink, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useConnect, useDisconnect, useAddress, useChainId, metamaskWallet, coinbaseWallet, walletConnect } from '@thirdweb-dev/react';

interface WalletInfo {
  address: string;
  chainId: string;
  chainName: string;
  isConnected: boolean;
}

interface ThirdwebWalletButtonProps {
  onWalletConnected: (walletInfo: WalletInfo) => void;
  onWalletDisconnected: () => void;
  connectedWallet?: WalletInfo | null;
}

export function ThirdwebWalletButton({ 
  onWalletConnected, 
  onWalletDisconnected, 
  connectedWallet 
}: ThirdwebWalletButtonProps) {
  const [copied, setCopied] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const connect = useConnect();
  const disconnect = useDisconnect();
  const address = useAddress();
  const chainId = useChainId();

  // Chain name mapping
  const getChainName = (chainId: number): string => {
    const chainNames: { [key: number]: string } = {
      1: 'Ethereum',
      137: 'Polygon',
      56: 'BSC',
      42161: 'Arbitrum',
      10: 'Optimism',
      250: 'Fantom',
      43114: 'Avalanche',
      8453: 'Base',
      324: 'zkSync Era',
      59144: 'Linea',
      534352: 'Scroll'
    };
    return chainNames[chainId] || `Chain ${chainId}`;
  };

  // Handle wallet connection
  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      
      // Try MetaMask first
      const metamaskConfig = metamaskWallet();
      await connect(metamaskConfig);
      
      // Show success message only when user clicks connect
      toast.success('Wallet connected successfully!');
      
    } catch (error: any) {
      console.error('Connection failed:', error);
      toast.error('Unable to connect wallet. Please try again.');
      setIsConnecting(false);
    }
  };

  // Handle wallet disconnection
  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error: any) {
      console.error('Disconnect failed:', error);
      toast.error('Unable to disconnect wallet. Please try again.');
    }
  };

  // Handle wallet connection changes
  useEffect(() => {
    if (address && chainId) {
      const walletInfo: WalletInfo = {
        address: address,
        chainId: chainId.toString(),
        chainName: getChainName(chainId),
        isConnected: true
      };
      
      onWalletConnected(walletInfo);
      setIsConnecting(false);
    } else if (!address && connectedWallet) {
      onWalletDisconnected();
      toast.info('Wallet disconnected');
    }
  }, [address, chainId, onWalletConnected, onWalletDisconnected, connectedWallet]);

  const copyAddress = async () => {
    if (connectedWallet?.address) {
      try {
        await navigator.clipboard.writeText(connectedWallet.address);
        setCopied(true);
        toast.success('Address copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        toast.error('Failed to copy address');
      }
    }
  };

  const openExplorer = () => {
    if (!connectedWallet?.address) return;
    
    const explorerUrls: { [key: string]: string } = {
      '1': `https://etherscan.io/address/${connectedWallet.address}`,
      '137': `https://polygonscan.com/address/${connectedWallet.address}`,
      '56': `https://bscscan.com/address/${connectedWallet.address}`,
      '42161': `https://arbiscan.io/address/${connectedWallet.address}`,
      '10': `https://optimistic.etherscan.io/address/${connectedWallet.address}`,
      '250': `https://ftmscan.com/address/${connectedWallet.address}`,
      '43114': `https://snowtrace.io/address/${connectedWallet.address}`,
      '8453': `https://basescan.org/address/${connectedWallet.address}`,
      '324': `https://explorer.zksync.io/address/${connectedWallet.address}`,
      '59144': `https://lineascan.build/address/${connectedWallet.address}`,
      '534352': `https://scrollscan.com/address/${connectedWallet.address}`
    };

    const explorerUrl = explorerUrls[connectedWallet.chainId] || `https://etherscan.io/address/${connectedWallet.address}`;
    window.open(explorerUrl, '_blank');
  };

  if (connectedWallet) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center space-x-2">
            <Wallet className="h-5 w-5 text-green-600" />
            <span>Connected Wallet</span>
            <Badge className="bg-green-500 text-white">Connected</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Address:</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-mono bg-white px-2 py-1 rounded border">
                  {connectedWallet.address.slice(0, 6)}...{connectedWallet.address.slice(-4)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyAddress}
                  className="h-8 w-8 p-0"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openExplorer}
                  className="h-8 w-8 p-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Network:</span>
              <Badge variant="outline" className="bg-white">
                {connectedWallet.chainName}
              </Badge>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button
              onClick={handleDisconnect}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
            <Button
              onClick={handleConnect}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              Switch Wallet
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center space-x-2">
          <Wallet className="h-5 w-5 text-blue-600" />
          <span>Connect Your Wallet</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Connect your wallet to automatically add your address and network information to the application.
        </p>
        
        <Button
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {isConnecting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="h-4 w-4 mr-2" />
              Connect Wallet
            </>
          )}
        </Button>
        
        <div className="text-xs text-gray-500 text-center">
          Supported networks: Ethereum, Polygon, BSC, Arbitrum, Optimism, Fantom, Avalanche, Base, zkSync Era, Linea, Scroll
        </div>
      </CardContent>
    </Card>
  );
}
