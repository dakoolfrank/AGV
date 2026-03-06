import { 
  KOLTier, 
  CommissionConfig, 
  SocialMiningConfig, 
  TierPolicy,
  MilestoneThresholds 
} from './types';

// Default configuration matching the Partner Agreement
export const DEFAULT_SOCIAL_MINING_CONFIG: SocialMiningConfig = {
  commission: {
    pioneer: {
      directMintsPct: 0.10,
      l1OverridePct: 0.05,
      l2OverridePct: 0.00
    },
    ambassador: {
      directMintsPct: 0.20,
      l1OverridePct: 0.10,
      l2OverridePct: 0.05
    },
    partner: {
      directMintsPct: 0.40,
      l1OverridePct: 0.20,
      l2OverridePct: 0.10
    }
  },
  settlement: {
    immediatePct: 0.40,
    vestDays: 90
  },
  caps: {
    postRewardsPerCycle: 8,
    maxOverridePerChildPerCycle: undefined
  },
  milestones: {
    pioneer: {
      M1: { likes: 150, reposts: 30, comments: 20, payoutPct: 0.25 },
      M2: { likes: 500, reposts: 100, comments: 60, payoutPct: 1.00 },
      M3: { mintsRequired: 5, bonusAmount: 50 }
    },
    ambassador: {
      M1: { likes: 300, reposts: 60, comments: 40, payoutPct: 0.25 },
      M2: { likes: 1000, reposts: 200, comments: 120, payoutPct: 1.00 },
      M3: { mintsRequired: 5, bonusAmount: 100 }
    },
    partner: {
      M1: { likes: 1000, reposts: 200, comments: 120, payoutPct: 0.25 },
      M2: { likes: 3000, reposts: 600, comments: 300, payoutPct: 1.00 },
      M3: { mintsRequired: 5, bonusAmount: 200 }
    }
  },
  antifraud: {
    maxPostsPerDay: 5,
    minTimeBetweenPosts: 60, // 1 hour
    velocityThreshold: 10,
    strikeLimit: 3
  }
};

export interface CommissionCalculationResult {
  direct: number;
  l1: number;
  l2: number;
  totalSystemCost: number;
}

/**
 * Calculate commission breakdown for a mint event
 */
export function calculateCommissions(
  mintValueUsd: number,
  childTier: KOLTier,
  l1Tier?: KOLTier,
  l2Tier?: KOLTier,
  config: CommissionConfig = DEFAULT_SOCIAL_MINING_CONFIG.commission
): CommissionCalculationResult {
  const direct = mintValueUsd * config[childTier].directMintsPct;
  const l1 = l1Tier ? mintValueUsd * config[l1Tier].l1OverridePct : 0;
  const l2 = l2Tier ? mintValueUsd * config[l2Tier].l2OverridePct : 0;
  
  return {
    direct,
    l1,
    l2,
    totalSystemCost: direct + l1 + l2
  };
}

export interface MilestoneCheckResult {
  M1: { achieved: boolean; payout: number };
  M2: { achieved: boolean; payout: number };
  M3: { achieved: boolean; payout: number };
}

/**
 * Check milestone achievements for a post
 */
export function checkMilestones(
  tier: KOLTier,
  metrics: { likes: number; reposts: number; comments: number },
  mintsLinked: number = 0,
  basePostReward: number = 100,
  config: MilestoneThresholds = DEFAULT_SOCIAL_MINING_CONFIG.milestones
): MilestoneCheckResult {
  const thresholds = config[tier];
  
  const M1 = {
    achieved: metrics.likes >= thresholds.M1.likes && 
              metrics.reposts >= thresholds.M1.reposts && 
              metrics.comments >= thresholds.M1.comments,
    payout: basePostReward * thresholds.M1.payoutPct
  };
  
  const M2 = {
    achieved: metrics.likes >= thresholds.M2.likes && 
              metrics.reposts >= thresholds.M2.reposts && 
              metrics.comments >= thresholds.M2.comments,
    payout: basePostReward * thresholds.M2.payoutPct
  };
  
  const M3 = {
    achieved: mintsLinked >= thresholds.M3.mintsRequired,
    payout: thresholds.M3.bonusAmount
  };
  
  return { M1, M2, M3 };
}

/**
 * Calculate settlement amounts (immediate vs vested)
 */
export function calculateSettlement(
  totalAmount: number,
  config: { immediatePct: number; vestDays: number } = DEFAULT_SOCIAL_MINING_CONFIG.settlement
): { immediate: number; vested: number } {
  const immediate = totalAmount * config.immediatePct;
  const vested = totalAmount - immediate;
  
  return { immediate, vested };
}

/**
 * Apply caps to rewards
 */
export function applyCaps(
  rewards: { postReward: number; overrideCommission: number },
  currentCyclePostRewards: number,
  config: { postRewardsPerCycle: number; maxOverridePerChildPerCycle?: number }
): { 
  cappedPostReward: number; 
  cappedOverride: number; 
  capApplied: boolean; 
  capReason?: string 
} {
  let cappedPostReward = rewards.postReward;
  let cappedOverride = rewards.overrideCommission;
  let capApplied = false;
  let capReason: string | undefined;
  
  // Apply post reward cap
  if (currentCyclePostRewards + rewards.postReward > config.postRewardsPerCycle * 100) { // Assuming $100 base reward
    const maxAdditional = (config.postRewardsPerCycle * 100) - currentCyclePostRewards;
    cappedPostReward = Math.max(0, maxAdditional);
    capApplied = true;
    capReason = 'Post reward cycle cap exceeded';
  }
  
  // Apply override cap if configured
  if (config.maxOverridePerChildPerCycle && rewards.overrideCommission > config.maxOverridePerChildPerCycle) {
    cappedOverride = config.maxOverridePerChildPerCycle;
    capApplied = true;
    capReason = capReason ? `${capReason}; Override cap applied` : 'Override cap applied';
  }
  
  return {
    cappedPostReward,
    cappedOverride,
    capApplied,
    capReason
  };
}

/**
 * Generate unified referral code
 */
export function generateReferralCode(kolId: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  
  return `KOL${kolId.substring(0, 3).toUpperCase()}${timestamp}`;
}

/**
 * Calculate weekly period identifier
 */
export function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const daysSinceStart = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
  
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Anti-fraud validation
 */
export interface FraudCheckResult {
  isValid: boolean;
  violations: string[];
  riskScore: number;
}

export function validatePostSubmission(
  kolId: string,
  recentPosts: Array<{ submittedAt: Date; platform: string }>,
  metrics: { likes: number; reposts: number; comments: number },
  config = DEFAULT_SOCIAL_MINING_CONFIG.antifraud
): FraudCheckResult {
  const violations: string[] = [];
  let riskScore = 0;
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Check daily post limit
  const postsToday = recentPosts.filter(post => {
    const postDate = new Date(post.submittedAt);
    const postDay = new Date(postDate.getFullYear(), postDate.getMonth(), postDate.getDate());
    return postDay.getTime() === today.getTime();
  }).length;
  
  if (postsToday >= config.maxPostsPerDay) {
    violations.push('Daily post limit exceeded');
    riskScore += 30;
  }
  
  // Check minimum time between posts
  if (recentPosts.length > 0) {
    const lastPost = recentPosts[0];
    const timeDiff = (now.getTime() - lastPost.submittedAt.getTime()) / (1000 * 60);
    
    if (timeDiff < config.minTimeBetweenPosts) {
      violations.push('Minimum time between posts not met');
      riskScore += 20;
    }
  }
  
  // Check for suspicious metrics (too high engagement rate)
  const totalEngagement = metrics.likes + metrics.reposts + metrics.comments;
  if (totalEngagement > config.velocityThreshold * 1000) {
    violations.push('Suspiciously high engagement metrics');
    riskScore += 40;
  }
  
  // Check for round numbers (potential bot activity)
  if (metrics.likes % 100 === 0 && metrics.likes > 1000) {
    violations.push('Suspicious round number metrics');
    riskScore += 15;
  }
  
  return {
    isValid: violations.length === 0,
    violations,
    riskScore
  };
}

/**
 * Utility to get tier hierarchy for commission calculation
 */
export function getTierHierarchy(childTier: KOLTier, l1Tier?: KOLTier, l2Tier?: KOLTier) {
  return {
    child: childTier,
    l1: l1Tier,
    l2: l2Tier
  };
}

/**
 * Calculate total system cost for a given mint value and tier structure
 */
export function calculateSystemCost(
  mintValueUsd: number,
  tierHierarchy: { child: KOLTier; l1?: KOLTier; l2?: KOLTier },
  config: CommissionConfig = DEFAULT_SOCIAL_MINING_CONFIG.commission
): number {
  const result = calculateCommissions(
    mintValueUsd,
    tierHierarchy.child,
    tierHierarchy.l1,
    tierHierarchy.l2,
    config
  );
  
  return result.totalSystemCost;
}
