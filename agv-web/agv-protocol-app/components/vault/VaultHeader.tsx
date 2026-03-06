'use client';

import { useEffect, useState } from 'react';
import { useVaultStore } from '@/lib/vault/store';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet } from 'lucide-react';
import { useActiveAccount, ConnectButton, useActiveWalletChain, useSwitchActiveWalletChain } from 'thirdweb/react';
import { thirdwebClient } from '@/components/wallet/wallet-connect';
import { bsc, polygon, arbitrum } from 'thirdweb/chains';
import { useTranslations } from '@/hooks/useTranslations';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useParams } from 'next/navigation';
import type { Locale } from '@/i18n';

type ChainKey = "56" | "42161" | "137";

const CHAIN_CONFIG: Record<
  ChainKey,
  { id: number; label: string; chain: any }
> = {
  "56": { id: 56, label: "BSC", chain: bsc },
  "42161": { id: 42161, label: "Arbitrum", chain: arbitrum },
  "137": { id: 137, label: "Polygon", chain: polygon },
};

export function VaultHeader() {
  const { t } = useTranslations();
  const { wallet, connectWallet, chainKey, setChainKey } = useVaultStore();
  const account = useActiveAccount();
  const activeChain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
  const params = useParams();
  const currentLocale = params.locale as Locale;

  // Update vault store when wallet connects/disconnect
  useEffect(() => {
    if (account?.address) {
      connectWallet(account.address as `0x${string}`);
    } else {
      // Clear wallet state when disconnected
      const { setWallet } = useVaultStore.getState();
      setWallet(undefined as any);
    }
  }, [account?.address, connectWallet]);

  const handleChainChange = async (newChainKey: ChainKey) => {
    setChainKey(newChainKey);
    
    // Switch wallet chain if needed
    if (activeChain?.id !== CHAIN_CONFIG[newChainKey].id) {
      try {
        await switchChain(CHAIN_CONFIG[newChainKey].chain);
      } catch (error) {
        console.warn('Failed to switch chain:', error);
      }
    }
  };


  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-white/5 backdrop-blur-xl rounded-lg border border-white/10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-blue-400" />
          <span className="text-sm font-medium text-white/80">
            {t('vault.header.wallet')}
          </span>
          <ConnectButton client={thirdwebClient} />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/80">
            {t('vault.header.network')}
          </span>
          <Select value={chainKey} onValueChange={handleChainChange}>
            <SelectTrigger className="w-32 bg-white/10 border-white/20 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-white/20">
              <SelectItem value="56" className="text-white hover:bg-white/10">BSC</SelectItem>
              <SelectItem value="137" className="text-white hover:bg-white/10">Polygon</SelectItem>
              <SelectItem value="42161" className="text-white hover:bg-white/10">Arbitrum</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <LanguageSwitcher 
          currentLocale={currentLocale} 
          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
        />
      </div>
    </div>
  );
}
