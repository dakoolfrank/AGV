import { FRAUD_DETECTION, SOCIAL_MINING_CONFIG } from './social-mining-config';
import { KOLProfile, PostSubmission, MintEvent } from './types';

export interface FraudCheckResult {
  isValid: boolean;
  riskScore: number;
  violations: string[];
  recommendations: string[];
}

export interface SuspiciousActivity {
  type: 'velocity' | 'engagement' | 'network' | 'pattern' | 'duplicate';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: any;
  timestamp: Date;
}

/**
 * Comprehensive fraud detection system for Social Mining
 */
export class AntiFraudEngine {
  
  /**
   * Validate a post submission for fraud indicators
   */
  static async validatePostSubmission(
    kol: KOLProfile,
    postData: {
      metrics: { likes: number; reposts: number; comments: number; views?: number };
      publishedAt: Date;
      platform: string;
    },
    recentPosts: PostSubmission[],
    teamMembers?: KOLProfile[]
  ): Promise<FraudCheckResult> {
    
    const violations: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;
    
    // 1. Velocity checks
    const velocityCheck = this.checkVelocity(postData, recentPosts);
    if (!velocityCheck.isValid) {
      violations.push(...velocityCheck.violations);
      riskScore += velocityCheck.riskScore;
    }
    
    // 2. Engagement rate analysis
    const engagementCheck = this.checkEngagementRate(kol, postData.metrics);
    if (!engagementCheck.isValid) {
      violations.push(...engagementCheck.violations);
      riskScore += engagementCheck.riskScore;
    }
    
    // 3. Pattern analysis
    const patternCheck = this.checkSuspiciousPatterns(postData.metrics, recentPosts);
    if (!patternCheck.isValid) {
      violations.push(...patternCheck.violations);
      riskScore += patternCheck.riskScore;
    }
    
    // 4. Network analysis (if team data available)
    if (teamMembers && teamMembers.length > 0) {
      const networkCheck = this.checkNetworkSuspicion(kol, teamMembers, postData.metrics);
      if (!networkCheck.isValid) {
        violations.push(...networkCheck.violations);
        riskScore += networkCheck.riskScore;
      }
    }
    
    // 5. Platform-specific checks
    const platformCheck = this.checkPlatformSpecific(postData.platform, postData.metrics);
    if (!platformCheck.isValid) {
      violations.push(...platformCheck.violations);
      riskScore += platformCheck.riskScore;
    }
    
    // Generate recommendations
    if (riskScore > 0) {
      recommendations.push(...this.generateRecommendations(violations, riskScore));
    }
    
    return {
      isValid: violations.length === 0,
      riskScore,
      violations,
      recommendations
    };
  }
  
  /**
   * Check posting velocity and timing patterns
   */
  private static checkVelocity(
    postData: { publishedAt: Date },
    recentPosts: PostSubmission[]
  ): FraudCheckResult {
    const violations: string[] = [];
    let riskScore = 0;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Check daily post limit
    const postsToday = recentPosts.filter(post => {
      const postDate = new Date(post.publishedAt);
      const postDay = new Date(postDate.getFullYear(), postDate.getMonth(), postDate.getDate());
      return postDay.getTime() === today.getTime();
    }).length;
    
    if (postsToday >= SOCIAL_MINING_CONFIG.antifraud.maxPostsPerDay) {
      violations.push(`Daily post limit exceeded (${postsToday}/${SOCIAL_MINING_CONFIG.antifraud.maxPostsPerDay})`);
      riskScore += 30;
    }
    
    // Check minimum time between posts
    if (recentPosts.length > 0) {
      const lastPost = recentPosts[0];
      const timeDiff = (now.getTime() - lastPost.publishedAt.getTime()) / (1000 * 60);
      
      if (timeDiff < SOCIAL_MINING_CONFIG.antifraud.minTimeBetweenPosts) {
        violations.push(`Minimum time between posts not met (${Math.round(timeDiff)} min)`);
        riskScore += 25;
      }
    }
    
    // Check for suspicious timing patterns (e.g., always posting at exact same time)
    if (recentPosts.length >= 5) {
      const postTimes = recentPosts.map(p => p.publishedAt.getHours() * 60 + p.publishedAt.getMinutes());
      const timeVariance = this.calculateVariance(postTimes);
      
      if (timeVariance < 30) { // Less than 30 minutes variance
        violations.push('Suspicious timing pattern detected');
        riskScore += 15;
      }
    }
    
    return {
      isValid: violations.length === 0,
      riskScore,
      violations,
      recommendations: []
    };
  }
  
  /**
   * Check engagement rates for suspicious activity
   */
  private static checkEngagementRate(
    kol: KOLProfile,
    metrics: { likes: number; reposts: number; comments: number; views?: number }
  ): FraudCheckResult {
    const violations: string[] = [];
    let riskScore = 0;
    
    // Get follower count from largest social platform
    const maxFollowers = Math.max(...kol.socials.map(s => s.followers));
    
    if (maxFollowers > 0) {
      const totalEngagement = metrics.likes + metrics.reposts + metrics.comments;
      const engagementRate = totalEngagement / maxFollowers;
      
      const maxAllowedRate = FRAUD_DETECTION.maxEngagementRate[kol.tier];
      
      if (engagementRate > maxAllowedRate) {
        violations.push(`Engagement rate too high (${(engagementRate * 100).toFixed(1)}% > ${(maxAllowedRate * 100).toFixed(1)}%)`);
        riskScore += 40;
      }
      
      // Check for impossible engagement (more engagement than followers)
      if (totalEngagement > maxFollowers * 1.5) {
        violations.push('Impossible engagement levels detected');
        riskScore += 50;
      }
    }
    
    // Check for round numbers (potential bot activity)
    const roundNumbers = [metrics.likes, metrics.reposts, metrics.comments].filter(n => 
      n > FRAUD_DETECTION.roundNumberThreshold && n % 100 === 0
    );
    
    if (roundNumbers.length >= 2) {
      violations.push('Multiple round number metrics detected');
      riskScore += 20;
    }
    
    // Check engagement ratios
    const likesToComments = metrics.comments > 0 ? metrics.likes / metrics.comments : 0;
    if (likesToComments > 100) { // More than 100:1 ratio is suspicious
      violations.push('Suspicious likes-to-comments ratio');
      riskScore += 15;
    }
    
    return {
      isValid: violations.length === 0,
      riskScore,
      violations,
      recommendations: []
    };
  }
  
  /**
   * Check for suspicious patterns in metrics
   */
  private static checkSuspiciousPatterns(
    currentMetrics: { likes: number; reposts: number; comments: number },
    recentPosts: PostSubmission[]
  ): FraudCheckResult {
    const violations: string[] = [];
    let riskScore = 0;
    
    if (recentPosts.length >= 3) {
      // Check for identical metrics
      const identicalPosts = recentPosts.filter(post => 
        post.likes === currentMetrics.likes &&
        post.reposts === currentMetrics.reposts &&
        post.comments === currentMetrics.comments
      );
      
      if (identicalPosts.length > 0) {
        violations.push('Identical metrics to previous posts detected');
        riskScore += 35;
      }
      
      // Check for linear progression (too perfect)
      const likesProgression = recentPosts.slice(0, 3).map(p => p.likes).sort((a, b) => a - b);
      if (this.isLinearProgression(likesProgression)) {
        violations.push('Suspicious linear progression in metrics');
        riskScore += 25;
      }
      
      // Check for rapid growth
      const lastPost = recentPosts[0];
      const growthFactor = currentMetrics.likes / (lastPost.likes || 1);
      
      if (growthFactor > FRAUD_DETECTION.rapidGrowthThreshold) {
        violations.push(`Rapid growth detected (${growthFactor.toFixed(1)}x increase)`);
        riskScore += 30;
      }
    }
    
    return {
      isValid: violations.length === 0,
      riskScore,
      violations,
      recommendations: []
    };
  }
  
  /**
   * Check for network-based suspicious activity
   */
  private static checkNetworkSuspicion(
    kol: KOLProfile,
    teamMembers: KOLProfile[],
    currentMetrics: { likes: number; reposts: number; comments: number }
  ): FraudCheckResult {
    const violations: string[] = [];
    let riskScore = 0;
    
    // Check for shared wallets
    const sharedWallets = teamMembers.filter(member => member.wallet === kol.wallet);
    if (sharedWallets.length > FRAUD_DETECTION.maxSharedWallets) {
      violations.push(`Too many shared wallets in network (${sharedWallets.length})`);
      riskScore += 45;
    }
    
    // Check for similar social profiles
    const similarProfiles = teamMembers.filter(member => {
      return member.socials.some(social => 
        kol.socials.some(kolSocial => 
          social.platform === kolSocial.platform &&
          Math.abs(social.followers - kolSocial.followers) < kolSocial.followers * 0.1
        )
      );
    });
    
    if (similarProfiles.length > 2) {
      violations.push('Multiple similar profiles in network detected');
      riskScore += 25;
    }
    
    return {
      isValid: violations.length === 0,
      riskScore,
      violations,
      recommendations: []
    };
  }
  
  /**
   * Platform-specific fraud checks
   */
  private static checkPlatformSpecific(
    platform: string,
    metrics: { likes: number; reposts: number; comments: number; views?: number }
  ): FraudCheckResult {
    const violations: string[] = [];
    let riskScore = 0;
    
    switch (platform.toLowerCase()) {
      case 'twitter':
      case 'x':
        // Twitter-specific checks
        if (metrics.reposts > metrics.likes) {
          violations.push('More retweets than likes (unusual for Twitter)');
          riskScore += 15;
        }
        break;
        
      case 'telegram':
        // Telegram-specific checks
        if (metrics.likes > 0 && metrics.views && metrics.likes > metrics.views) {
          violations.push('More reactions than views (impossible for Telegram)');
          riskScore += 40;
        }
        break;
        
      case 'youtube':
        // YouTube-specific checks
        if (metrics.views && metrics.likes > metrics.views * 0.1) {
          violations.push('Unusually high like-to-view ratio for YouTube');
          riskScore += 20;
        }
        break;
    }
    
    return {
      isValid: violations.length === 0,
      riskScore,
      violations,
      recommendations: []
    };
  }
  
  /**
   * Generate recommendations based on violations
   */
  private static generateRecommendations(violations: string[], riskScore: number): string[] {
    const recommendations: string[] = [];
    
    if (riskScore > 70) {
      recommendations.push('High risk detected - manual review required');
      recommendations.push('Consider temporary suspension pending investigation');
    } else if (riskScore > 40) {
      recommendations.push('Medium risk detected - enhanced monitoring recommended');
      recommendations.push('Request additional verification documents');
    } else if (riskScore > 20) {
      recommendations.push('Low risk detected - monitor for patterns');
    }
    
    if (violations.some(v => v.includes('engagement rate'))) {
      recommendations.push('Verify follower authenticity and engagement quality');
    }
    
    if (violations.some(v => v.includes('velocity') || v.includes('timing'))) {
      recommendations.push('Review posting schedule and timing patterns');
    }
    
    if (violations.some(v => v.includes('network') || v.includes('shared'))) {
      recommendations.push('Investigate network connections and shared resources');
    }
    
    return recommendations;
  }
  
  /**
   * Utility functions
   */
  private static calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((sum, sq) => sum + sq, 0) / numbers.length;
  }
  
  private static isLinearProgression(numbers: number[]): boolean {
    if (numbers.length < 3) return false;
    
    const diff1 = numbers[1] - numbers[0];
    const diff2 = numbers[2] - numbers[1];
    
    return Math.abs(diff1 - diff2) < Math.max(diff1, diff2) * 0.1; // Within 10% tolerance
  }
  
  /**
   * Batch fraud analysis for multiple KOLs
   */
  static async analyzeBatch(kols: KOLProfile[], timeWindow: number = 24): Promise<{
    suspiciousKols: Array<{ kol: KOLProfile; riskScore: number; violations: string[] }>;
    networkFlags: Array<{ type: string; kols: string[]; description: string }>;
  }> {
    const suspiciousKols: Array<{ kol: KOLProfile; riskScore: number; violations: string[] }> = [];
    const networkFlags: Array<{ type: string; kols: string[]; description: string }> = [];
    
    // Individual KOL analysis would go here
    // Network analysis would go here
    
    return { suspiciousKols, networkFlags };
  }
}

/**
 * Strike system for managing KOL violations
 */
export class StrikeSystem {
  
  static async addStrike(
    kolId: string, 
    violation: string, 
    severity: 'minor' | 'major' | 'critical',
    evidence?: any
  ): Promise<{ totalStrikes: number; action: 'warning' | 'suspension' | 'termination' | 'none' }> {
    
    // In production, this would interact with the database
    // For now, return mock response
    
    const strikeWeight = severity === 'critical' ? 2 : severity === 'major' ? 1.5 : 1;
    const totalStrikes = 2; // Mock value
    
    let action: 'warning' | 'suspension' | 'termination' | 'none' = 'none';
    
    if (totalStrikes >= SOCIAL_MINING_CONFIG.antifraud.strikeLimit) {
      action = 'suspension';
    } else if (totalStrikes >= SOCIAL_MINING_CONFIG.antifraud.strikeLimit - 1) {
      action = 'warning';
    }
    
    return { totalStrikes, action };
  }
  
  static async getStrikes(kolId: string): Promise<Array<{
    id: string;
    violation: string;
    severity: string;
    timestamp: Date;
    evidence?: any;
  }>> {
    // Mock implementation
    return [];
  }
}

export default AntiFraudEngine;
