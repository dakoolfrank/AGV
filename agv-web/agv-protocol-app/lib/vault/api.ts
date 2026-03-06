export type LockTier = "flex" | "1m" | "3m" | "6m" | "12m";
export type NftType = "Seed" | "Tree" | "Solar";

export interface AprData {
  apr: number;
  split: {
    real: number;
    boost: number;
    social: number;
  };
}

export interface XpData {
  xp: number;
  asOf?: number;
}

export interface NftPosition {
  type: NftType;
  start_ts: number;
  lock_tier?: string;
}

export interface NftsData {
  wallet: string;
  positions: NftPosition[];
}

export interface LeaderboardRow {
  rank: number;
  wallet: string;
  rggp: number;
  xp: number;
}

export interface LeaderboardData {
  asOf: number;
  rows: LeaderboardRow[];
}

export interface TiersData {
  tiers: Record<LockTier, AprData>;
  nftMultipliers: Record<NftType, number>;
}

/**
 * Fetch APR data for a specific tier
 */
export async function getApr(tier: LockTier): Promise<AprData> {
  const response = await fetch(`/api/vault/apr?tier=${tier}`, {
    next: { revalidate: 60 }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch APR data: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch XP data for a wallet
 */
export async function getXp(wallet: string): Promise<XpData> {
  const response = await fetch(`/api/vault/xp?wallet=${wallet}`, {
    cache: 'no-store'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch XP data: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch NFT positions for a wallet
 */
export async function getNfts(wallet: string): Promise<NftsData> {
  const response = await fetch(`/api/vault/nfts?wallet=${wallet}`, {
    next: { revalidate: 60 }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch NFT data: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch leaderboard data
 */
export async function getLeaderboard(): Promise<LeaderboardData> {
  const response = await fetch('/api/vault/leaderboard', {
    next: { revalidate: 3600 }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard data: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch static tiers data
 */
export async function getTiersStatic(): Promise<TiersData> {
  const response = await fetch('/tiers.json', {
    next: { revalidate: 60 }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch tiers data: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch all vault data for a wallet
 */
export async function getVaultData(wallet: string): Promise<{
  apr: AprData;
  xp: XpData;
  nfts: NftsData;
  tiers: TiersData;
}> {
  const [apr, xp, nfts, tiers] = await Promise.all([
    getApr('flex'), // Default tier, will be updated based on user selection
    getXp(wallet),
    getNfts(wallet),
    getTiersStatic()
  ]);

  return { apr, xp, nfts, tiers };
}
