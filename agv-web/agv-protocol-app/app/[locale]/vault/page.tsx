'use client';

import { useEffect, useState } from 'react';
import { useVaultStore, WalletNFT } from '@/lib/vault/store';
import { usePeriodicValidation } from '@/lib/vault/usePeriodicValidation';
import { useTranslations } from '@/hooks/useTranslations';
import { VaultHeader } from '@/components/vault/VaultHeader';
import { LiveCounter } from '@/components/vault/LiveCounter';
import { AprBars } from '@/components/vault/AprBars';
import { PositionsList } from '@/components/vault/PositionCard';
import { XpPanel } from '@/components/vault/XpPanel';
import { Leaderboard } from '@/components/vault/Leaderboard';
import { NftSelector } from '@/components/vault/NftSelector';
import { VaultWarning } from '@/components/vault/VaultWarning';
import { TierSelector } from '@/components/vault/TierSelector';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, Wallet } from 'lucide-react';
import { Footer } from "@/components/layout/footer";

export default function VaultPage() {
  const { t } = useTranslations();
  const { 
    wallet, 
    isLoading, 
    error, 
    clearError, 
    refreshData, 
    connectWallet,
    lockedNfts,
    setLockedNfts,
    tier
  } = useVaultStore();
  
  const [showTierSelector, setShowTierSelector] = useState(true);

  // Start periodic validation of locked NFTs
  usePeriodicValidation();

  // Auto-refresh data every 5 minutes
  useEffect(() => {
    if (!wallet) return;

    const interval = setInterval(() => {
      refreshData();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [wallet, refreshData]);

  // Load data when wallet connects
  useEffect(() => {
    if (wallet) {
      connectWallet(wallet);
    }
  }, [wallet, connectWallet]);

  // Handle tier selection
  const handleTierSelected = () => {
    setShowTierSelector(false);
  };

  // Reset tier selector when no NFTs are locked
  useEffect(() => {
    if (lockedNfts.length === 0) {
      setShowTierSelector(true);
    }
  }, [lockedNfts.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            {t('vault.title')}
          </h1>
          <p className="text-lg text-white/80">
            {t('vault.subtitle')}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 border-red-500/20 bg-red-500/10 backdrop-blur-xl">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <AlertDescription className="flex items-center justify-between text-red-300">
              <span>{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="ml-4 text-red-300 hover:text-red-200 hover:bg-red-500/20"
              >
                {t('common.close')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Vault Header */}
        <div className="mb-8">
          <VaultHeader />
        </div>

        {/* Vault Warning */}
        <VaultWarning />

        {/* Main Content Grid */}
        {wallet ? (
          lockedNfts.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Main Stats */}
              <div className="lg:col-span-2 space-y-8">
                {/* Live Counter */}
                <LiveCounter />
                
                {/* APR Bars */}
                <AprBars />
                
                {/* Positions */}
                <PositionsList />
              </div>

              {/* Right Column - Sidebar */}
              <div className="space-y-8">
                {/* XP Panel */}
                <XpPanel />
                
                {/* Leaderboard */}
                <Leaderboard />
              </div>
            </div>
          ) : showTierSelector ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Tier Selection */}
              <div className="lg:col-span-2 space-y-8">
                {/* Tier Selector */}
                <TierSelector onTierSelected={handleTierSelected} />
              </div>

              {/* Right Column - Sidebar */}
              <div className="space-y-8">
                {/* XP Panel */}
                <XpPanel />
                
                {/* Leaderboard */}
                <Leaderboard />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - NFT Selection */}
              <div className="lg:col-span-2 space-y-8">
                {/* NFT Selector */}
                <NftSelector 
                  onNftsSelected={(selectedNfts) => {
                    // Convert selected NFTs to locked NFTs format
                    const lockedNfts = selectedNfts.map(nft => ({
                      ...nft,
                      nftType: (nft as WalletNFT & { nftType?: string }).nftType || 'unknown',
                      lockTier: tier,
                      lockTimestamp: Math.floor(Date.now() / 1000)
                    }));
                    setLockedNfts(lockedNfts);
                  }}
                  selectedNfts={lockedNfts}
                />
              </div>

              {/* Right Column - Sidebar */}
              <div className="space-y-8">
                {/* XP Panel */}
                <XpPanel />
                
                {/* Leaderboard */}
                <Leaderboard />
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-16">
            <div className="max-w-md mx-auto">
              <div className="mb-6">
                <div className="p-4 rounded-full bg-blue-500/20 inline-block mb-4">
                  <Wallet className="h-12 w-12 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {t('vault.connectWallet.title')}
                </h2>
                <p className="text-white/80 mb-6">
                  {t('vault.connectWallet.description')}
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="text-sm text-white/70">
                  <p>{t('vault.connectWallet.features.title')}</p>
                  <ul className="mt-2 space-y-1 text-left">
                    <li>• {t('vault.connectWallet.features.liveEarnings')}</li>
                    <li>• {t('vault.connectWallet.features.stakedPositions')}</li>
                    <li>• {t('vault.connectWallet.features.trackXp')}</li>
                    <li>• {t('vault.connectWallet.features.leaderboard')}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Refresh Button */}
        {wallet && (
          <div className="mt-8 text-center">
            <Button
              onClick={refreshData}
              disabled={isLoading}
              variant="outline"
              className="min-w-32 bg-white/5 border-white/20 text-white hover:bg-white/10"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('vault.refresh.refreshing')}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('vault.refresh.refreshData')}
                </>
              )}
            </Button>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-12 text-center text-sm text-white/60">
          <p className="mt-2">
            {t('vault.footer.dataUpdates')}
          </p>
        </div>
      </div>
      <Footer
        backgroundClass="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900"
        textColorClass="text-white"
      />
    </div>
  );
}
