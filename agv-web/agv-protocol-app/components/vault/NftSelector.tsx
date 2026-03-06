'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Image, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { NFT_CONTRACTS } from '@/lib/contracts';
import { useVaultStore, WalletNFT } from '@/lib/vault/store';
import { useTranslations } from '@/hooks/useTranslations';

interface NftSelectorProps {
  onNftsSelected: (selectedNfts: WalletNFT[]) => void;
  selectedNfts: WalletNFT[];
}

export function NftSelector({ onNftsSelected, selectedNfts }: NftSelectorProps) {
  const { t } = useTranslations();
  const [nfts, setNfts] = useState<WalletNFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const account = useActiveAccount();
  const { chainKey, validateLockedNfts } = useVaultStore();

  // Get NFT contract addresses for selected chain
  const getNftContracts = () => {
    const contracts = NFT_CONTRACTS[chainKey as keyof typeof NFT_CONTRACTS];
    if (!contracts) return [];
    
    return [
      { address: contracts.seed, type: 'seed' },
      { address: contracts.tree, type: 'tree' },
      { address: contracts.solar, type: 'solar' },
      { address: contracts.compute, type: 'compute' },
    ];
  };

  const fetchWalletNfts = async () => {
    
    if (!account?.address) return;
    setIsLoading(true);
    setError(null);
    
    try {
      const nftContracts = getNftContracts();

      if (nftContracts.length === 0) {
        setError('NFT contracts not available for this chain');
        return;
      }

      // Fetch NFTs for each contract
      const allNfts: WalletNFT[] = [];
      
      for (const contract of nftContracts) {
        try {
          const response = await fetch(
            `/api/wallet-nfts?address=${account.address}&chain=${chainKey}`
          );
          
          if (!response.ok) {
            console.warn(`Failed to fetch NFTs for contract ${contract.address}`);
            continue;
          }
          
          const data = await response.json();
          const contractNfts = (data.items || [])
            .filter((nft: WalletNFT) => 
              nft.tokenAddress.toLowerCase() === contract.address.toLowerCase()
            )
            .map((nft: WalletNFT) => ({
              ...nft,
              nftType: contract.type,
            }));
          
          allNfts.push(...contractNfts);
        } catch (err) {
          console.warn(`Error fetching NFTs for contract ${contract.address}:`, err);
        }
      }
      
      setNfts(allNfts);
      
      // Validate locked NFTs are still in wallet
      validateLockedNfts(allNfts);
    } catch (err) {
      setError('Failed to fetch wallet NFTs');
      console.error('Error fetching wallet NFTs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (account?.address) {
      fetchWalletNfts();
    }
  }, [account?.address, chainKey]);

  const handleNftToggle = (nft: WalletNFT, checked: boolean) => {
    if (checked) {
      onNftsSelected([...selectedNfts, nft]);
    } else {
      onNftsSelected(selectedNfts.filter(selected => 
        selected.tokenAddress !== nft.tokenAddress || selected.tokenIdStr !== nft.tokenIdStr
      ));
    }
  };

  const isNftSelected = (nft: WalletNFT) => {
    return selectedNfts.some(selected => 
      selected.tokenAddress === nft.tokenAddress && selected.tokenIdStr === nft.tokenIdStr
    );
  };

  const getNftTypeColor = (nftType: string) => {
    switch (nftType) {
      case 'seed': return 'bg-green-500/20 text-green-400 border-green-500/20';
      case 'tree': return 'bg-amber-500/20 text-amber-400 border-amber-500/20';
      case 'solar': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20';
      case 'compute': return 'bg-blue-500/20 text-blue-400 border-blue-500/20';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/20';
    }
  };

  if (!account) {
    return (
      <Card className="w-full bg-white/5 backdrop-blur-xl border-white/10">
        <CardContent className="text-center py-12">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-blue-500/20">
                <Image className="h-12 w-12 text-blue-400" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-white">{t('vault.nftSelector.connectWallet')}</h3>
              <p className="text-white/70">
                {t('vault.nftSelector.connectDescription')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="w-full bg-white/5 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            {t('vault.nftSelector.loading')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white/10 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full bg-white/5 backdrop-blur-xl border-white/10">
        <CardContent className="text-center py-12">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-red-500/20">
                <AlertTriangle className="h-12 w-12 text-red-400" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-white">{t('vault.nftSelector.error')}</h3>
              <p className="text-white/70 mb-4">{error}</p>
              <Button 
                onClick={fetchWalletNfts}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                {t('vault.nftSelector.tryAgain')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (nfts.length === 0) {
    return (
      <Card className="w-full bg-white/5 backdrop-blur-xl border-white/10">
        <CardContent className="text-center py-12">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-purple-500/20">
                <Image className="h-12 w-12 text-purple-400" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-white">{t('vault.nftSelector.noNfts')}</h3>
              <p className="text-white/70 mb-4">
                {t('vault.nftSelector.noNftsDescription')}
              </p>
              <Button 
                asChild
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <a href="/mint" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t('vault.nftSelector.goToMint')}
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-white/5 backdrop-blur-xl border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image className="h-5 w-5 text-blue-400" />
            <span className="text-white">{t('vault.nftSelector.title')}</span>
          </div>
          <Badge variant="outline" className="bg-white/10 border-white/20 text-white">
            {selectedNfts.length} {t('vault.nftSelector.selected')}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
          {nfts.map((nft) => (
            <div
              key={`${nft.tokenAddress}-${nft.tokenIdStr}`}
              className={`relative p-4 rounded-lg border transition-all cursor-pointer ${
                isNftSelected(nft)
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
              onClick={() => handleNftToggle(nft, !isNftSelected(nft))}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isNftSelected(nft)}
                  onCheckedChange={(checked) => handleNftToggle(nft, !!checked)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getNftTypeColor((nft as WalletNFT & { nftType?: string }).nftType || 'unknown')}`}
                    >
                      {(nft as WalletNFT & { nftType?: string }).nftType?.toUpperCase() || 'NFT'}
                    </Badge>
                  </div>
                  <div className="text-sm font-medium text-white truncate">
                    {nft.name || `#${nft.tokenIdStr}`}
                  </div>
                  <div className="text-xs text-white/60">
                    Token ID: {nft.tokenIdStr}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {selectedNfts.length > 0 && (
          <div className="mt-6 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">
                {selectedNfts.length} NFT{selectedNfts.length !== 1 ? 's' : ''} {t('vault.nftSelector.selectedForLocking')}
              </span>
              <Button 
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={() => {
                  if (selectedNfts.length > 0) {
                    onNftsSelected(selectedNfts);
                  }
                }}
              >
                {t('vault.nftSelector.lockNfts')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
