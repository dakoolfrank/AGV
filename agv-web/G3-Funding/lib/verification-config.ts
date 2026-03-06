// Verification Configuration
// This file should be added to .gitignore and configured with actual API keys

export const VERIFICATION_CONFIG = {
  // Enable manual verification
  enableManualVerification: true,
  
  // Require verification code for manual verification
  requireVerificationCode: true,
  
  // Verification timeouts
  timeouts: {
    manualVerification: 24 * 60 * 60 * 1000, // 24 hours
  },
  
  // Minimum requirements for verification
  minimumRequirements: {
    twitter: {
      minFollowers: 100,
      minPosts: 5,
      accountAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    },
    youtube: {
      minSubscribers: 100,
      minVideos: 3,
      accountAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    },
    instagram: {
      minFollowers: 100,
      minPosts: 5,
      accountAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    },
    tiktok: {
      minFollowers: 100,
      minVideos: 3,
      accountAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  }
};

// Get available verification methods for a platform
export const getAvailableVerificationMethods = (_platform: string): string[] => {
  const methods: string[] = [];
  
  if (VERIFICATION_CONFIG.enableManualVerification) {
    methods.push('manual');
  }
  
  return methods;
};
