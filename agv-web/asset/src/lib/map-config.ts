// Map API Configuration
// You'll need to get API keys from the respective services

export const MAP_CONFIG = {
  // AMap (AutoNavi Map) - Primary for Chinese users
  AMAP_KEY: process.env.NEXT_PUBLIC_AMAP_KEY || 'YOUR_AMAP_KEY',
  
  // Google Maps - For client-side map display (server-side geocoding uses GOOGLE_MAPS_API_KEY)
  GOOGLE_MAPS_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || 'YOUR_GOOGLE_MAPS_KEY',
  
  // OpenCage Geocoding - For address search
  OPENCAGE_KEY: process.env.NEXT_PUBLIC_OPENCAGE_KEY || 'YOUR_OPENCAGE_KEY',
  
  // Default coordinates (Beijing for Chinese users)
  DEFAULT_CENTER: {
    lat: 39.9042,
    lng: 116.4074
  }
};

// Helper function to detect if user is likely in China
export const isChineseUser = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return (
    Intl.DateTimeFormat().resolvedOptions().timeZone.includes('Asia/Shanghai') ||
    navigator.language.includes('zh') ||
    navigator.languages.some(lang => lang.includes('zh'))
  );
};
