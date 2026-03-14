// Configuration constants for the AGV NEXRUR Presale System

export const CONFIG = {
  // Thirdweb Configuration
  THIRDWEB_CLIENT_ID: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
  
  // Contract Addresses
  AIRDROP_BADGE_CONTRACT: process.env.NEXT_PUBLIC_AIRDROP_BADGE_CONTRACT || '0x1234567890123456789012345678901234567890',
  
  // Token Economics
  PREGVT_PRICE_USD: 0.005, // $0.005 per preGVT
  REDEMPTION_VALUE_PER_BADGE: 1000, // 1000 preGVT per badge
  EARNING_RATE_PER_MINUTE: 0.1, // 0.1 preGVT per minute
  
} as const;

