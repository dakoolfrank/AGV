import { ChainId, NftType, MintingCap, NftInfo } from "./types";

/** ---------------- Sale Caps & Limits ---------------- **/
export const MODE_CAPS_BY_CHAIN: Record<NftType, Record<ChainId, MintingCap>> = {
  seed: {
    "56": { whitelist: 100, public: 250 },
    "137": { whitelist: 50, public: 100 },
    "42161": { whitelist: 50, public: 50 },
  },
  tree: {
    "56": { whitelist: 50, public: 150 },
    "137": { whitelist: 25, public: 50 },
    "42161": { whitelist: 25, public: 50 },
  },
  solar: {
    "56": { whitelist: 100, public: 50 },
    "137": { whitelist: 50, public: 25 },
    "42161": { whitelist: 50, public: 25 },
  },
  compute: {
    "56": { whitelist: 40, public: 10 },
    "137": { whitelist: 29, public: 5 },
    "42161": { whitelist: 29, public: 5 },
  },
} as const;

export const MAX_PER_WALLET: Record<NftType, Record<ChainId, number>> = {
  seed: { "56": 3, "137": 3, "42161": 3 },
  tree: { "56": 2, "137": 2, "42161": 2 },
  solar: { "56": 2, "137": 2, "42161": 2 },
  compute: { "56": 1, "137": 1, "42161": 1 },
} as const;

/** ---------------- NFT metadata (UI only) ---------------- **/
export const NFT_INFO: Record<NftType, NftInfo> = {
  seed: { name: "SeedPass", description: "Access to basic features", color: "bg-blue-500" },
  tree: { name: "TreePass", description: "Enhanced capabilities", color: "bg-green-500" },
  solar: { name: "SolarPass", description: "Premium features", color: "bg-yellow-500" },
  compute: { name: "ComputePass", description: "Full platform access", color: "bg-purple-500" },
} as const;

/** Correct USDT decimals per chain (fallback) */
export const USDT_DECIMALS_FALLBACK: Record<ChainId, number> = {
  "56": 18,
  "137": 6,
  "42161": 6,
} as const;

/** Gas thresholds per chain */
export const GAS_THRESHOLDS: Record<ChainId, number> = { 
  "56": 0.005, 
  "137": 0.01, 
  "42161": 0.001 
} as const;
