// Types for Institutional Partnership Application (Form A)
export interface InstitutionalApplication {
  id?: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'new' | 'kyb_review' | 'legal_review' | 'commercial_review' | 'approved' | 'revisions_needed' | 'declined';
  
  // 1) Purpose & Fit
  purposeAndFit: {
    primaryIntent: ('advocacy_partner' | 'financial_support' | 'token_contribution' | 'strategic_partner')[];
    whatYouWantToGain: ('user_growth' | 'resource_access' | 'education_narrative' | 'brand_reputation' | 'long_term_leverage')[];
    howOrgSupportsRWA: string;
    rwaVerticals: ('energy' | 'agriculture' | 'real_estate' | 'carbon_esg' | 'supply_chain' | 'other')[];
    otherVertical?: string;
  };
  
  // 2) Organization Profile
  organizationProfile: {
    legalEntityName: string;
    jurisdiction: string;
    registrationNumber: string;
    registeredAddress: string;
    website?: string;
    organizationType: 'exchange' | 'fund' | 'asset_owner_originator' | 'technology_provider' | 'ngo_alliance' | 'corporate' | 'other';
    otherOrganizationType?: string;
    regulatoryPermissions?: string;
    regulatoryFiles?: string[]; // File URLs
    briefHistory?: string;
  };
  
  // 3) Contacts
  contacts: {
    primary: {
      name: string;
      title: string;
      email: string;
      phone?: string;
    };
    compliance?: {
      name?: string;
      email?: string;
    };
    brandPr?: {
      name?: string;
      email?: string;
    };
  };
  
  // 4) Partnership Mode
  partnershipMode: {
    advocacyPartner?: {
      advocacyScope: ('co_branded_education' | 'policy_roundtables' | 'thought_leadership' | 'events')[];
      regionsOfAdvocacy: ('apac' | 'eu' | 'mena' | 'africa' | 'americas')[];
      expectedTimeline: {
        startDate: string;
        endDate: string;
      };
    };
    financialSupport?: {
      instrument: 'grant' | 'sponsorship';
      currency: 'USD' | 'USDT';
      amount: number;
      disbursementSchedule: string;
      accountingRequirements?: string;
    };
    tokenContribution?: {
      tokenName: string;
      chain: string;
      contractAddress: string;
      allocationAmount: number;
      transferMechanics: 'immediate_transfer' | 'vesting_contract' | 'timelock' | 'custodial_escrow';
      vestingTerms: {
        cliffMonths: number;
        vestingMonths: number;
        type: 'linear' | 'step';
      };
      permittedUses: ('kol_bounties' | 'education_grants' | 'community_incentives' | 'data_research_rewards')[];
      reportingNeeded: ('wallet_proofs' | 'distribution_dashboards' | 'periodic_summaries')[];
    };
    strategicPartner?: {
      coBrandingExpectations: string;
      priorityDataAccess: ('user_growth_metrics' | 'wallet_staking_kpis' | 'campaign_analytics' | 'geographic_breakdowns')[];
      networkAccessSought: ('asset_partners' | 'exchanges' | 'funds' | 'kol_cohorts' | 'education_channels')[];
      confidentialityLevel: 'public' | 'partners_only' | 'nda_required';
    };
  };
  
  // 5) Geography & Audience
  geographyAndAudience: {
    targetRegions: string[];
    languagePreferences: string[];
    audienceSegments: ('retail' | 'prosumer_kols' | 'developers' | 'institutions' | 'policy_education')[];
  };
  
  // 6) Wallets & Payment Rails
  walletsAndPayment: {
    settlementPreference: 'bank' | 'crypto';
    walletAddresses: {
      chain: string;
      address: string;
    }[];
    complianceConstraints?: string;
  };
  
  // 7) Data, Reporting & Compliance
  dataReporting: {
    consentToOnChainVerification: boolean;
    preferredReportingCadence: 'monthly' | 'quarterly';
    dataSharingAgreementNeeded: boolean;
    securityPrivacyRequirements?: string;
  };
  
  // 8) Brand Usage & Approvals
  brandUsage: {
    logoFiles?: string[]; // File URLs
    brandGuidelines?: string; // URL or file
    approvalFlowForMentions?: string;
  };
  
  // 9) Risk Acknowledgement & Legal
  riskAcknowledgement: {
    riskDisclosureAcknowledged: boolean;
    termsPrivacyConsent: boolean;
    conflictsOfInterest?: string;
  };
  
  // Attachments
  attachments: {
    regulatoryDocuments?: Array<{
      name: string;
      url: string;
      size: number;
      type: string;
      uploadedAt: string;
    }>;
    certificateOfIncorporation?: string; // File URL
    licenses?: string[]; // File URLs
    sanctionsPepScreening?: string; // File URL
    tokenEconomicsMemo?: string; // File URL
    mouLoi?: string; // File URL
  };
  
  // Admin fields
  reviewerNotes?: string;
  lastReviewedBy?: string;
  lastReviewedAt?: Date;
}

// Types for Contributor Application (Form B)
export interface ContributorApplication {
  id?: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'new' | 'review' | 'approved' | 'revisions_needed' | 'declined';
  tier: 'airdrop_hunter' | 'contributor' | 'micro_kol' | 'fund_partner';
  
  // 1) Identity & Contact
  identity: {
    displayName: string;
    email: string;
    telegramHandle: string;
    countryRegion: string;
    languages: string[];
    riskTermsConsent: boolean;
  };
  
  // 2) Channels & Metrics
  channels: {
    platform: string;
    url: string;
    followers: number;
    avgViews30d?: number;
    audienceTop3Geos: string[];
    contentFocus: string;
    verificationStatus?: 'pending' | 'verified' | 'failed';
    verificationMethod?: 'manual' | 'pending';
    verifiedAt?: Date;
    verifiedProfile?: {
      platform: string;
      username: string;
      displayName: string;
      followers: number;
      following?: number;
      posts?: number;
      verified: boolean;
      profileUrl: string;
      profileImage?: string;
      bio?: string;
      location?: string;
      joinedDate?: Date;
      lastActivity?: Date;
      engagementRate?: number;
      avgViews?: number;
      avgLikes?: number;
      avgComments?: number;
    };
  }[];
  
  // 3) Role & Availability (Contributor+)
  roleAndAvailability?: {
    roles: ('educator' | 'analyst' | 'community_builder' | 'event_host' | 'translator' | 'content_creator' | 'technical_writer')[];
    availabilityHoursPerWeek: number;
    regionsCanCover: string[];
  };
  
  // 4) Performance KPIs (Contributor+)
  performanceKpis?: {
    kpiTargets: {
      impressions?: number;
      clicks?: number;
      mintsStakes?: number;
      retentionPercent?: number;
      educationCompletions?: number;
    };
    consistencyWindow?: number; // For Micro-KOL
    strategicKpi?: string; // For Fund Partner
  };
  
  // 5) Rewards & Compensation
  rewardsCompensation: {
    compensationModel: 'fixed' | 'performance' | 'hybrid';
    paymentRails: {
      usdt?: {
        chain: string;
        address: string;
      };
      fiat?: {
        bankDetails: string;
      };
    };
  };
  
  // 6) Portfolio & Track Record (Contributor+)
  portfolio?: {
    recentWorkLinks: string[];
    outcomesSummary?: string;
    conflictsExclusivity?: string;
  };
  
  // 7) Wallets & Verification
  wallets: {
    chain: string;
    address: string;
  }[];
  kycUpload?: string; // File URL
  consentToPublicDashboards: boolean;
  
  // 8) Community & Compliance
  communityCompliance: {
    agreeToKolGuidelines: boolean;
    agreeToCommunityRules: boolean;
    antiFraudAcknowledgement: boolean;
  };
  
  // 9) Referrals
  referrals: {
    referredByG3Partner?: boolean;
  };
  
  // Attachments
  attachments: {
    portfolioFiles?: Array<{
      name: string;
      url: string;
      size: number;
      type: string;
      uploadedAt: string;
    }>;
  };
  
  // Admin fields
  reviewerNotes?: string;
  lastReviewedBy?: string;
  lastReviewedAt?: Date;
}

// Admin dashboard types
export interface AdminStats {
  institutionalApplications: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
  contributorApplications: {
    total: number;
    byStatus: Record<string, number>;
    byTier: Record<string, number>;
  };
  recentApplications: (InstitutionalApplication | ContributorApplication)[];
}

// Social Mining Program Types
export type KOLTier = 'pioneer' | 'ambassador' | 'partner';
export type KOLStatus = 'active' | 'suspended' | 'pending' | 'inactive';
export type PostMilestone = 'M1' | 'M2' | 'M3';
export type PostStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface KOLProfile {
  id: string;
  tier: KOLTier;
  status: KOLStatus;
  
  // Unified referral code
  refCode: string; // Single code for both user mints and KOL recruitment
  
  // Hierarchy
  sponsorRef?: string; // refCode of parent KOL
  
  // Profile data
  displayName: string;
  email: string;
  wallet: string;
  region: string[];
  languages: string[];
  socials: {
    platform: string;
    url: string;
    username: string;
    followers: number;
    verified: boolean;
  }[];
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt?: Date;
  
  // Campaign context
  campaign: string; // e.g., "G3"
}

export interface KOLRecruitment {
  id: string;
  sponsorKolId: string;
  childKolId: string;
  sponsorRef: string;
  childRef: string;
  timestamp: Date;
  campaign: string;
}

export interface MintEvent {
  id: string;
  refCode: string;
  creditedKolId: string;
  wallet: string;
  txHash: string;
  network: string;
  mintValueUsd: number;
  timestamp: Date;
  campaign: string;
}

export interface PostSubmission {
  id: string;
  kolId: string;
  postUrl: string;
  platform: string;
  content: string;
  publishedAt: Date;
  submittedAt: Date;
  
  // Evidence
  screenshots: string[]; // URLs to uploaded screenshots
  utmParams?: string;
  
  // Metrics (captured at submission + verification)
  likes: number;
  reposts: number;
  comments: number;
  views?: number;
  
  // Milestones
  milestones: {
    M1: { achieved: boolean; timestamp?: Date; payout: number };
    M2: { achieved: boolean; timestamp?: Date; payout: number };
    M3: { achieved: boolean; timestamp?: Date; payout: number; mintsLinked: number };
  };
  
  // Status
  status: PostStatus;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewerNotes?: string;
  
  // Validation window
  windowStartAt: Date;
  windowEndAt: Date;
  
  campaign: string;
}

export interface RewardsLedger {
  id: string;
  period: string; // e.g., "2024-10-W1"
  kolId: string;
  
  // Own earnings
  ownPostReward: number;
  ownMintsCommission: number;
  
  // Override earnings from downline
  l1OverrideCommission: number;
  l2OverrideCommission: number;
  
  // Totals
  totalEarned: number;
  immediateAmount: number; // 40%
  vestedAmount: number;    // 60%
  
  // Caps applied
  capApplied: boolean;
  capReason?: string;
  
  // Timestamps
  calculatedAt: Date;
  campaign: string;
}

export interface PayoutRequest {
  id: string;
  kolId: string;
  amount: number;
  currency: 'USDT' | 'USD';
  walletAddress?: string;
  bankDetails?: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestedAt: Date;
  processedAt?: Date;
  txHash?: string;
  notes?: string;
}

export interface VestingSchedule {
  id: string;
  kolId: string;
  walletAddress: string;
  totalAmount: number;
  vestedAmount: number;
  unlockedAmount: number;
  remainingAmount: number;
  startDate: Date;
  cliffDate: Date;
  endDate: Date;
  vestingDays: number;
  cliffDays: number;
  duration: number; // Total duration in days
  dailyVestAmount: number;
  lastClaimAt?: Date;
  status: 'active' | 'completed' | 'cancelled';
}

// Configuration types
export interface TierPolicy {
  directMintsPct: number;
  l1OverridePct: number;
  l2OverridePct: number;
}

export interface CommissionConfig {
  pioneer: TierPolicy;
  ambassador: TierPolicy;
  partner: TierPolicy;
}

export interface MilestoneThresholds {
  [tier: string]: {
    M1: { likes: number; reposts: number; comments: number; payoutPct: number };
    M2: { likes: number; reposts: number; comments: number; payoutPct: number };
    M3: { mintsRequired: number; bonusAmount: number };
  };
}

export interface SocialMiningConfig {
  commission: CommissionConfig;
  settlement: {
    immediatePct: number;
    vestDays: number;
  };
  caps: {
    postRewardsPerCycle: number;
    maxOverridePerChildPerCycle?: number;
  };
  milestones: MilestoneThresholds;
  antifraud: {
    maxPostsPerDay: number;
    minTimeBetweenPosts: number; // minutes
    velocityThreshold: number;
    strikeLimit: number;
  };
}

// Dashboard data types
export interface KOLDashboardData {
  profile: KOLProfile;
  currentPeriod: {
    ownPosts: {
      submitted: number;
      approved: number;
      m1Achieved: number;
      m2Achieved: number;
      m3Achieved: number;
      totalReward: number;
    };
    ownConversions: {
      clicks: number;
      mints: number;
      conversionRate: number;
      commission: number;
      purchaseReferrals?: number;
      purchaseCommission?: number;
    };
    overrides: {
      l1Commission: number;
      l2Commission: number;
    };
    earnings: {
      total: number;
      immediate: number;
      vested: number;
    };
  };
  team: {
    l1KOLs: Array<{
      id: string;
      displayName: string;
      tier: KOLTier;
      status: KOLStatus;
      mints: number;
      commissionGenerated: number;
      lastActive: Date;
    }>;
    l2KOLs: Array<{
      id: string;
      displayName: string;
      tier: KOLTier;
      status: KOLStatus;
      mints: number;
      commissionGenerated: number;
      lastActive: Date;
      parentId: string;
    }>;
  };
  payouts: {
    accrued: number;
    claimable: number;
    vested: number;
    pendingRequests: PayoutRequest[];
  };
  compliance: {
    pendingPosts: number;
    approvedPosts: number;
    rejectedPosts: number;
    strikes: number;
  };
}

export interface GlobalMintCounter {
  campaign: string;
  totalMints: number;
  totalValue: number;
  last7Days: Array<{
    date: string;
    mints: number;
    value: number;
  }>;
  updatedAt: Date;
}