import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { 
  LockTier, 
  NftType, 
  AprData, 
  XpData, 
  NftsData, 
  TiersData,
  LeaderboardData,
  getVaultData,
  getLeaderboard
} from './api';
import { 
  dailyYield, 
  calculateAccrued, 
  clampDaily, 
  perSecondRate 
} from './math';
import { saveVaultData, loadVaultData, loadAllVaultData } from './firestore';

export interface WalletNFT {
  tokenAddress: string;
  tokenIdStr: string;
  contractType: string;
  name: string | null;
  imageUrl: string | null;
}

export interface LockedNFT {
  tokenAddress: string;
  tokenIdStr: string;
  contractType: string;
  name: string | null;
  imageUrl: string | null;
  nftType: string;
  lockTier: LockTier;
  lockTimestamp: number;
}

export interface VaultState {
  // Wallet and tier selection
  wallet?: `0x${string}`;
  tier: LockTier;
  chainKey: "56" | "42161" | "137";
  
  // Data
  xp?: XpData;
  tiers?: TiersData;
  positions: Array<{ type: NftType; start_ts: number; lock_tier?: string }>;
  leaderboard?: LeaderboardData;
  lockedNfts: LockedNFT[];
  
  // Computed values
  rggpAccrued: number;
  dailyYieldTotal: number;
  perSecondRate: number;
  
  // Loading states
  isLoading: boolean;
  error?: string;
  
  // Validation state
  lastValidationTime: number;
  
  // Actions
  setWallet: (wallet: `0x${string}`) => void;
  setTier: (tier: LockTier) => void;
  setChainKey: (chainKey: "56" | "42161" | "137") => void;
  setLockedNfts: (nfts: LockedNFT[]) => void;
  unlockNft: (tokenAddress: string, tokenIdStr: string) => void;
  unlockAllNfts: () => void;
  validateLockedNfts: (walletNfts: WalletNFT[]) => void;
  performPeriodicValidation: () => Promise<void>;
  hydrateFromApis: (wallet: string) => Promise<void>;
  refreshData: () => Promise<void>;
  clearError: () => void;
  loadFromFirestore: (wallet: string, chainKey: string) => Promise<void>;
  saveToFirestore: () => Promise<void>;
  recalculateYields: () => void;
  setLeaderboard: (leaderboard: LeaderboardData) => void;
  connectWallet: (wallet: string) => Promise<void>;
}

export const useVaultStore = create<VaultState>()(
  devtools(
    (set, get) => ({
      // Initial state
      wallet: undefined,
      tier: 'flex',
      chainKey: '56',
      xp: undefined,
      tiers: undefined,
      positions: [],
      leaderboard: undefined,
      lockedNfts: [],
      rggpAccrued: 0,
      dailyYieldTotal: 0,
      perSecondRate: 0,
      isLoading: false,
      error: undefined,
      lastValidationTime: 0,

      // Actions
      setWallet: (wallet) => {
        set({ wallet });
        // Clear locked NFTs when wallet disconnects
        if (!wallet) {
          set({ lockedNfts: [], rggpAccrued: 0, dailyYieldTotal: 0, perSecondRate: 0 });
        }
      },

      setTier: (tier) => {
        set({ tier });
        // Recalculate yields when tier changes
        get().recalculateYields();
      },

      setChainKey: (chainKey) => {
        set({ chainKey });
      },

      setLockedNfts: (lockedNfts) => {
        set({ lockedNfts });
        // Recalculate yields when locked NFTs change
        get().recalculateYields();
        // Save to Firestore
        get().saveToFirestore();
      },

      unlockNft: (tokenAddress, tokenIdStr) => {
        const { lockedNfts } = get();
        const updatedNfts = lockedNfts.filter(
          nft => !(nft.tokenAddress === tokenAddress && nft.tokenIdStr === tokenIdStr)
        );
        set({ lockedNfts: updatedNfts });
        get().recalculateYields();
        get().saveToFirestore();
      },

      unlockAllNfts: () => {
        set({ lockedNfts: [] });
        get().recalculateYields();
        get().saveToFirestore();
      },

      validateLockedNfts: (walletNfts) => {
        const { lockedNfts } = get();
        const validNfts = lockedNfts.filter(lockedNft => 
          walletNfts.some(walletNft => 
            walletNft.tokenAddress.toLowerCase() === lockedNft.tokenAddress.toLowerCase() &&
            walletNft.tokenIdStr === lockedNft.tokenIdStr
          )
        );
        
        if (validNfts.length !== lockedNfts.length) {
          set({ lockedNfts: validNfts });
          get().recalculateYields();
          get().saveToFirestore();
        }
      },

      performPeriodicValidation: async () => {
        const { wallet, chainKey, lockedNfts, lastValidationTime } = get();
        
        // Only validate if we have locked NFTs and wallet
        if (!wallet || lockedNfts.length === 0) return;
        
        // Check if 30 minutes have passed since last validation
        const now = Date.now();
        const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds
        
        if (now - lastValidationTime < thirtyMinutes) {
          return; // Not time yet
        }
        
        try {
          // Fetch current wallet NFTs
          const response = await fetch(`/api/wallet-nfts?address=${wallet}&chain=${chainKey}`);
          if (!response.ok) {
            console.warn('Failed to fetch wallet NFTs for validation');
            return;
          }
          
          const data = await response.json();
          const walletNfts = data.items || [];
          
          // Validate locked NFTs
          const validNfts = lockedNfts.filter(lockedNft => 
            walletNfts.some((walletNft: WalletNFT) => 
              walletNft.tokenAddress.toLowerCase() === lockedNft.tokenAddress.toLowerCase() &&
              walletNft.tokenIdStr === lockedNft.tokenIdStr
            )
          );
          
          // Update if any NFTs were removed
          if (validNfts.length !== lockedNfts.length) {
            const removedCount = lockedNfts.length - validNfts.length;
            console.log(`Periodic validation: ${removedCount} NFT(s) no longer in wallet, removing from vault`);
            
            set({ 
              lockedNfts: validNfts,
              lastValidationTime: now 
            });
            get().recalculateYields();
            get().saveToFirestore();
          } else {
            // Update validation time even if no changes
            set({ lastValidationTime: now });
            get().saveToFirestore();
          }
        } catch (error) {
          console.error('Error during periodic validation:', error);
        }
      },

      hydrateFromApis: async (wallet) => {
        set({ isLoading: true, error: undefined });
        
        try {
          const { apr, xp, nfts, tiers } = await getVaultData(wallet);
          const leaderboard = await getLeaderboard();
          
          set({
            xp,
            tiers,
            positions: nfts.positions,
            leaderboard,
            isLoading: false
          });
          
          // Recalculate yields with new data
          get().recalculateYields();
        } catch (error) {
          console.error('Error hydrating vault data:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to load vault data',
            isLoading: false
          });
        }
      },

      refreshData: async () => {
        const { wallet } = get();
        if (wallet) {
          await get().hydrateFromApis(wallet);
        }
      },

      clearError: () => set({ error: undefined }),

      // Helper method to recalculate yields
      recalculateYields: () => {
        const { tier, xp, tiers, lockedNfts } = get();
        
        if (!tiers || !xp) return;

        const tierData = tiers.tiers[tier];
        const nftMultipliers = tiers.nftMultipliers;
        
        let totalDailyYield = 0;
        let totalAccrued = 0;
        
        lockedNfts.forEach(lockedNft => {
          const nftMult = nftMultipliers[lockedNft.nftType as keyof typeof nftMultipliers] || 1;
          const dailyYieldForNft = dailyYield(
            tierData.apr,
            nftMult,
            xp.xp
          );
          
          totalDailyYield += dailyYieldForNft;
          
          // Calculate accrued rewards
          const accrued = calculateAccrued(
            lockedNft.lockTimestamp,
            dailyYieldForNft
          );
          totalAccrued += accrued;
        });
        
        // Apply daily cap
        const cappedDailyYield = clampDaily(totalDailyYield);
        const perSecond = perSecondRate(cappedDailyYield);
        
        set({
          dailyYieldTotal: cappedDailyYield,
          perSecondRate: perSecond,
          rggpAccrued: totalAccrued
        });
      },

      // Firestore persistence methods
      loadFromFirestore: async (wallet: string, chainKey: string) => {
        try {
          const data = await loadVaultData(wallet, chainKey);
          if (data) {
            set({
              lockedNfts: data.lockedNfts,
              lastValidationTime: data.lastValidationTime
            });
            // Recalculate yields after loading
            get().recalculateYields();
          }
        } catch (error) {
          console.error('Failed to load vault data from Firestore:', error);
        }
      },

      saveToFirestore: async () => {
        const { wallet, chainKey, lockedNfts, lastValidationTime } = get();
        if (wallet && chainKey) {
          try {
            await saveVaultData(wallet, chainKey, lockedNfts, lastValidationTime);
          } catch (error) {
            console.error('Failed to save vault data to Firestore:', error);
          }
        }
      },

      setLeaderboard: (leaderboard) => {
        set({ leaderboard });
      },

      connectWallet: async (wallet: `0x${string}`) => {
        set({ wallet });
        
        try {
          // First load API data
          await get().hydrateFromApis(wallet);
          
          // Then load Firestore data
          const { chainKey } = get();
          await get().loadFromFirestore(wallet, chainKey);
        } catch (error) {
          console.error('Failed to connect wallet:', error);
        }
      }
    }),
    {
      name: 'vault-store'
    }
  )
);
