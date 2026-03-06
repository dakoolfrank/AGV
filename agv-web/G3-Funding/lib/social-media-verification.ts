// Social Media Verification Service
// Implements manual verification for social media channels

export interface SocialMediaProfile {
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
}

export interface VerificationResult {
  isValid: boolean;
  profile?: SocialMediaProfile;
  errors: string[];
  warnings: string[];
  verificationMethod: 'manual' | 'pending';
  verifiedAt?: Date;
}

export interface VerificationConfig {
  enableManualVerification: boolean;
  requireVerificationCode: boolean;
}

// Extract username from URL
export const extractUsernameFromUrl = (url: string, platform: string): string | null => {
  try {
    const urlObj = new URL(url);
    
    switch (platform) {
      case 'twitter':
      case 'x':
        const twitterMatch = urlObj.pathname.match(/\/([^\/]+)/);
        return twitterMatch ? twitterMatch[1].replace('@', '') : null;
        
      case 'youtube':
        if (urlObj.pathname.includes('/@')) {
          const youtubeMatch = urlObj.pathname.match(/\/@([^\/]+)/);
          return youtubeMatch ? youtubeMatch[1] : null;
        } else if (urlObj.pathname.includes('/c/')) {
          const youtubeCMatch = urlObj.pathname.match(/\/c\/([^\/]+)/);
          return youtubeCMatch ? youtubeCMatch[1] : null;
        } else if (urlObj.pathname.includes('/channel/')) {
          const youtubeChannelMatch = urlObj.pathname.match(/\/channel\/([^\/]+)/);
          return youtubeChannelMatch ? youtubeChannelMatch[1] : null;
        }
        return null;
        
      case 'tiktok':
        const tiktokMatch = urlObj.pathname.match(/\/@([^\/]+)/);
        return tiktokMatch ? tiktokMatch[1] : null;
        
      case 'instagram':
        const instagramMatch = urlObj.pathname.match(/\/([^\/]+)/);
        return instagramMatch ? instagramMatch[1] : null;
        
      case 'linkedin':
        if (urlObj.pathname.includes('/in/')) {
          const linkedinMatch = urlObj.pathname.match(/\/in\/([^\/]+)/);
          return linkedinMatch ? linkedinMatch[1] : null;
        }
        return null;
        
      default:
        return null;
    }
  } catch {
    return null;
  }
};

// Generate verification code for manual verification
export const generateVerificationCode = (): string => {
  return `G3-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
};

// Manual verification only - no API verification

// Manual verification with verification code
export const initiateManualVerification = async (
  platform: string,
  _username: string,
  _profileUrl: string
): Promise<{ verificationCode: string; instructions: string }> => {
  const verificationCode = generateVerificationCode();
  
  const instructions = {
    twitter: `Please add the verification code "${verificationCode}" to your Twitter bio temporarily. We will verify your account within 24 hours.`,
    youtube: `Please add the verification code "${verificationCode}" to your YouTube channel description temporarily. We will verify your account within 24 hours.`,
    instagram: `Please add the verification code "${verificationCode}" to your Instagram bio temporarily. We will verify your account within 24 hours.`,
    tiktok: `Please add the verification code "${verificationCode}" to your TikTok bio temporarily. We will verify your account within 24 hours.`,
    linkedin: `Please add the verification code "${verificationCode}" to your LinkedIn headline temporarily. We will verify your account within 24 hours.`,
    default: `Please add the verification code "${verificationCode}" to your ${platform} profile temporarily. We will verify your account within 24 hours.`
  };

  return {
    verificationCode,
    instructions: instructions[platform as keyof typeof instructions] || instructions.default
  };
};

// Main verification function - Manual verification only
export const verifySocialMediaChannel = async (
  platform: string,
  url: string,
  config: VerificationConfig
): Promise<VerificationResult> => {
  const username = extractUsernameFromUrl(url, platform);
  
  if (!username) {
    return {
      isValid: false,
      errors: ['Invalid URL format for the selected platform'],
      warnings: [],
      verificationMethod: 'pending'
    };
  }

  // Always use manual verification
  if (config.enableManualVerification) {
    const manualVerification = await initiateManualVerification(platform, username, url);
    return {
      isValid: false,
      errors: ['Manual verification required'],
      warnings: [manualVerification.instructions],
      verificationMethod: 'manual'
    };
  }

  return {
    isValid: false,
    errors: ['Manual verification disabled'],
    warnings: [],
    verificationMethod: 'pending'
  };
};

// Batch verification for multiple channels
export const verifyMultipleChannels = async (
  channels: Array<{ platform: string; url: string }>,
  config: VerificationConfig
): Promise<VerificationResult[]> => {
  const results: VerificationResult[] = [];
  
  for (const channel of channels) {
    const result = await verifySocialMediaChannel(channel.platform, channel.url, config);
    results.push(result);
    
    // Add delay between API calls to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
};

// Check if verification is required for a tier
export const requiresVerification = (tier: string): boolean => {
  return tier !== 'airdrop_hunter';
};

// Manual verification only - no third-party services
