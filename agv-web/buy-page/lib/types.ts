// Database types for Firebase
export interface User {
  id: string;
  address: string;
  totalEarned: number;
  redeemedAmount: number;
  accruedAmount: number;
  activationTime: string | null;
  lastUpdated: string;
  isActivated: boolean;
  nftOwnership: {
    [chainId: string]: {
      [nftType: string]: {
        balance: number;
        tokenIds: number[];
        lastChecked: string;
      };
    };
  };
  eligibility: {
    hasRequiredNfts: boolean;
    requiredNftTypes: string[];
    lastChecked: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LeaderboardEntry extends User {
  rank: number;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
