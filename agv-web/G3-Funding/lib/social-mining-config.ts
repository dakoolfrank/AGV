import { SocialMiningConfig } from './types';

/**
 * Central configuration for the G3 Social Mining Program
 * This file contains all configurable parameters for the program
 */

export const SOCIAL_MINING_CONFIG: SocialMiningConfig = {
  // Commission rates by tier
  commission: {
    pioneer: {
      directMintsPct: 0.10,    // 10% direct commission
      l1OverridePct: 0.05,     // 5% L1 override
      l2OverridePct: 0.00      // 0% L2 override
    },
    ambassador: {
      directMintsPct: 0.20,    // 20% direct commission
      l1OverridePct: 0.10,     // 10% L1 override
      l2OverridePct: 0.05      // 5% L2 override
    },
    partner: {
      directMintsPct: 0.40,    // 40% direct commission (matches Partner Agreement)
      l1OverridePct: 0.20,     // 20% L1 override (matches Partner Agreement)
      l2OverridePct: 0.10      // 10% L2 override (matches Partner Agreement)
    }
  },
  
  // Settlement configuration
  settlement: {
    immediatePct: 0.40,       // 40% paid immediately
    vestDays: 90              // 60% vests over 90 days
  },
  
  // Reward caps
  caps: {
    postRewardsPerCycle: 8,   // Maximum 8 post rewards per cycle
    maxOverridePerChildPerCycle: undefined // No override cap by default
  },
  
  // Milestone thresholds by tier
  milestones: {
    pioneer: {
      M1: { 
        likes: 150, 
        reposts: 30, 
        comments: 20, 
        payoutPct: 0.25 
      },
      M2: { 
        likes: 500, 
        reposts: 100, 
        comments: 60, 
        payoutPct: 1.00 
      },
      M3: { 
        mintsRequired: 5, 
        bonusAmount: 50 
      }
    },
    ambassador: {
      M1: { 
        likes: 300, 
        reposts: 60, 
        comments: 40, 
        payoutPct: 0.25 
      },
      M2: { 
        likes: 1000, 
        reposts: 200, 
        comments: 120, 
        payoutPct: 1.00 
      },
      M3: { 
        mintsRequired: 5, 
        bonusAmount: 100 
      }
    },
    partner: {
      M1: { 
        likes: 1000, 
        reposts: 200, 
        comments: 120, 
        payoutPct: 0.25 
      },
      M2: { 
        likes: 3000, 
        reposts: 600, 
        comments: 300, 
        payoutPct: 1.00 
      },
      M3: { 
        mintsRequired: 5, 
        bonusAmount: 200 
      }
    }
  },
  
  // Anti-fraud configuration
  antifraud: {
    maxPostsPerDay: 5,        // Maximum posts per day
    minTimeBetweenPosts: 60,  // Minimum 60 minutes between posts
    velocityThreshold: 10,    // Velocity threshold multiplier
    strikeLimit: 3           // Maximum strikes before suspension
  }
};

// Regional multipliers for milestone thresholds
export const REGIONAL_MULTIPLIERS = {
  'North America': 1.0,
  'Europe': 1.0,
  'Asia Pacific': 0.8,
  'Latin America': 0.7,
  'Middle East & Africa': 0.6,
  'Other': 0.8
};

// Platform-specific multipliers
export const PLATFORM_MULTIPLIERS = {
  twitter: 1.0,
  telegram: 0.8,
  discord: 0.7,
  youtube: 1.2,
  tiktok: 0.9,
  instagram: 1.1,
  linkedin: 0.8,
  other: 0.8
};

// Base post reward amounts by tier (in USD)
export const BASE_POST_REWARDS = {
  pioneer: 100,
  ambassador: 150,
  partner: 200
};

// Minimum requirements for tier upgrades
export const TIER_UPGRADE_REQUIREMENTS = {
  pioneer_to_ambassador: {
    minFollowers: 10000,
    minConversionRate: 0.02,
    minPostsApproved: 20,
    minTeamSize: 3
  },
  ambassador_to_partner: {
    minFollowers: 100000,
    minConversionRate: 0.03,
    minPostsApproved: 50,
    minTeamSize: 10,
    inviteOnly: true
  }
};

// Fraud detection thresholds
export const FRAUD_DETECTION = {
  // Engagement rate thresholds (likes + comments + reposts / followers)
  maxEngagementRate: {
    pioneer: 0.15,      // 15% max engagement rate
    ambassador: 0.12,   // 12% max engagement rate  
    partner: 0.10       // 10% max engagement rate
  },
  
  // Suspicious patterns
  roundNumberThreshold: 100,  // Flag if metrics are round numbers > 100
  rapidGrowthThreshold: 5.0,  // Flag if engagement grows >5x in 24h
  
  // Velocity checks
  maxMintsPerHour: 10,        // Maximum mints per hour from single KOL
  maxPostsPerHour: 2,         // Maximum posts per hour
  
  // Network analysis
  maxSharedWallets: 3,        // Maximum shared wallets in team
  maxSimilarMetrics: 0.95     // Flag if >95% similar metrics in team
};

// Compliance and legal
export const COMPLIANCE_CONFIG = {
  // KYC requirements by tier
  kycRequired: {
    pioneer: false,
    ambassador: false,
    partner: true
  },
  
  // Payout thresholds requiring additional verification
  payoutVerificationThreshold: 1000, // USD
  
  // Regional restrictions
  restrictedRegions: [
    // Add restricted regions as needed
  ],
  
  // Data retention
  dataRetentionDays: 2555, // ~7 years
  
  // Audit trail
  auditLogRetentionDays: 365
};

// Performance tracking
export const PERFORMANCE_METRICS = {
  // KPI tracking windows
  trackingWindows: {
    daily: 1,
    weekly: 7,
    monthly: 30,
    quarterly: 90
  },
  
  // Benchmark targets
  benchmarks: {
    conversionRate: {
      pioneer: 0.015,     // 1.5% target conversion rate
      ambassador: 0.025,  // 2.5% target conversion rate
      partner: 0.035      // 3.5% target conversion rate
    },
    
    teamGrowth: {
      pioneer: 1,         // 1 new team member per month
      ambassador: 3,      // 3 new team members per month
      partner: 5          // 5 new team members per month
    }
  }
};

// Export utility functions
export function getConfigForTier(tier: string) {
  return {
    commission: SOCIAL_MINING_CONFIG.commission[tier as keyof typeof SOCIAL_MINING_CONFIG.commission],
    milestones: SOCIAL_MINING_CONFIG.milestones[tier],
    baseReward: BASE_POST_REWARDS[tier as keyof typeof BASE_POST_REWARDS],
    kycRequired: COMPLIANCE_CONFIG.kycRequired[tier as keyof typeof COMPLIANCE_CONFIG.kycRequired]
  };
}

export function getRegionalMultiplier(region: string): number {
  return REGIONAL_MULTIPLIERS[region as keyof typeof REGIONAL_MULTIPLIERS] || REGIONAL_MULTIPLIERS.Other;
}

export function getPlatformMultiplier(platform: string): number {
  return PLATFORM_MULTIPLIERS[platform as keyof typeof PLATFORM_MULTIPLIERS] || PLATFORM_MULTIPLIERS.other;
}

export function adjustMilestonesForRegion(tier: string, region: string) {
  const baseMilestones = SOCIAL_MINING_CONFIG.milestones[tier];
  const multiplier = getRegionalMultiplier(region);
  
  return {
    M1: {
      ...baseMilestones.M1,
      likes: Math.floor(baseMilestones.M1.likes * multiplier),
      reposts: Math.floor(baseMilestones.M1.reposts * multiplier),
      comments: Math.floor(baseMilestones.M1.comments * multiplier)
    },
    M2: {
      ...baseMilestones.M2,
      likes: Math.floor(baseMilestones.M2.likes * multiplier),
      reposts: Math.floor(baseMilestones.M2.reposts * multiplier),
      comments: Math.floor(baseMilestones.M2.comments * multiplier)
    },
    M3: baseMilestones.M3 // M3 is conversion-based, no regional adjustment
  };
}
