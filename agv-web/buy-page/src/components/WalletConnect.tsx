"use client";

import { ConnectButton, useActiveAccount, useActiveWallet } from "thirdweb/react";
import { useDisconnect } from "thirdweb/react";
import { thirdwebClient, supportedWallets, defaultChain } from "@/app/provider";
import { useWallet } from "@/lib/wallet-provider";
import { LogOut, Copy, ExternalLink, AlertTriangle, CheckCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { CHAINS } from "@/lib/contracts";
import { bsc, arbitrum, polygon } from "thirdweb/chains";
import { useState, useEffect } from "react";
import { useTranslations } from "@/lib/translation-provider";

// Mobile detection utility
const isMobileDevice = () => {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

// Check if MetaMask mobile app is installed
const isMetaMaskInstalled = () => {
  if (typeof window === "undefined") return false;
  return typeof (window as any).ethereum !== "undefined" && (window as any).ethereum.isMetaMask;
};

export function WalletConnect() {
  const { t } = useTranslations('walletConnect');
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const { chainId, chainName } = useWallet();
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileOptions, setShowMobileOptions] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  const copyAddress = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address);
      toast.success(t('addressCopied'));
    }
  };

  const openExplorer = () => {
    if (account?.address && chainId) {
      const chain = CHAINS[chainId as keyof typeof CHAINS];
      if (chain) {
        window.open(`${chain.explorer}/address/${account.address}`, '_blank');
      }
    }
  };

  // Deep link functions for mobile wallets
  const openInMetaMask = () => {
    const dappUrl = window.location.href;
    const metamaskDeepLink = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
    window.location.href = metamaskDeepLink;
    toast.info(t('openingMetaMask'));
  };

  const openInTrustWallet = () => {
    const dappUrl = encodeURIComponent(window.location.href);
    const trustWalletDeepLink = `trust://open_url?url=${dappUrl}`;
    window.location.href = trustWalletDeepLink;
    toast.info(t('openingTrustWallet'));
  };

  const openInCoinbase = () => {
    const dappUrl = window.location.href;
    const coinbaseDeepLink = `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(dappUrl)}`;
    window.location.href = coinbaseDeepLink;
    toast.info(t('openingCoinbase'));
  };

  if (!account) {
    return (
      <div className="flex flex-col gap-4">
        {/* Mobile-specific deep link buttons */}
        {isMobile && (
          <div className="flex flex-col gap-3 mb-2">
            <p className="text-sm text-center text-slate-300">{t('quickConnect')}</p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={openInMetaMask}
                className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold"
              >
                <Smartphone className="mr-2 h-4 w-4" />
                {t('openInMetaMask')}
              </Button>
              <Button
                onClick={openInTrustWallet}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold"
              >
                <Smartphone className="mr-2 h-4 w-4" />
                {t('openInTrustWallet')}
              </Button>
              <Button
                onClick={openInCoinbase}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold"
              >
                <Smartphone className="mr-2 h-4 w-4" />
                {t('openInCoinbase')}
              </Button>
            </div>
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-600"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-2 text-slate-400">{t('orUseWalletConnect')}</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Standard ConnectButton */}
        <div className="flex justify-center">
          <ConnectButton 
            client={thirdwebClient}
            wallets={supportedWallets}
            chain={defaultChain}
            chains={[bsc, arbitrum, polygon]}
            connectButton={{
              label: isMobile ? t('useWalletConnect') : t('connectWallet'),
              style: {
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                color: "white",
                borderRadius: "8px",
                padding: "12px 24px",
                fontSize: "14px",
                fontWeight: "500",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                backdropFilter: "blur(10px)",
                width: isMobile ? "100%" : "auto",
              }
            }}
            connectModal={{
              size: "wide",
              title: isMobile ? t('connectViaWalletConnect') : t('connectYourWallet'),
              titleIcon: "",
              showThirdwebBranding: false,
              welcomeScreen: isMobile ? {
                title: t('scanWithWallet'),
                subtitle: t('useWalletConnectScan')
              } : {
                title: t('connectToPreGVT'),
                subtitle: t('choosePreferredWallet')
              },
            }}
            appMetadata={{
              name: "PreGVT",
              url: typeof window !== "undefined" ? window.location.origin : "https://presale.agvprotocol.org",
              description: "PreGVT Token Presale - Buy preGVT Tokens",
              logoUrl: "https://presale.agvprotocol.org/agv-logo.png",
            }}
            theme="dark"
            autoConnect={true}
          />
        </div>
      </div>
    );
  }

  const currentChain = chainId ? CHAINS[chainId as keyof typeof CHAINS] : null;

  return (
    <div className="flex items-center gap-2 bg-green-500/10 backdrop-blur-sm border border-green-400/30 rounded-lg px-3 py-2">
      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-green-300 font-medium">
          {account.address?.slice(0, 6)}...{account.address?.slice(-4)}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={copyAddress}
            className="h-6 w-6 p-0 hover:bg-green-400/20"
          >
            <Copy className="h-3 w-3 text-green-300" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={openExplorer}
            className="h-6 w-6 p-0 hover:bg-green-400/20"
          >
            <ExternalLink className="h-3 w-3 text-green-300" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => wallet && disconnect(wallet)}
            className="h-6 w-6 p-0 hover:bg-red-400/20"
          >
            <LogOut className="h-3 w-3 text-red-400" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function WalletStatus() {
  const { t } = useTranslations('walletConnect');
  const account = useActiveAccount();
  const { chainId, chainName } = useWallet();

  if (!account) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">{t('walletNotConnected')}</p>
              <p className="text-sm text-amber-700">
                {t('connectWalletToStart')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentChain = chainId ? CHAINS[chainId as keyof typeof CHAINS] : null;

  return (
    <Card className="border-green-200 bg-green-50">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-medium text-green-800">{t('walletConnected')}</p>
            <p className="text-sm text-green-700">
              {account.address?.slice(0, 6)}...{account.address?.slice(-4)} {t('on')} {currentChain?.name || chainName}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
