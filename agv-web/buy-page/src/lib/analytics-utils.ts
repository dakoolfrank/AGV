import { NextRequest } from 'next/server';
import { UAParser } from 'ua-parser-js';
export interface GeolocationData {
  country: string | null;
  region: string | null;
  city: string | null;
}

export interface DeviceData {
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  browser: string | null;
  os: string | null;
  userAgent: string | null;
}

export interface AnalyticsMetadata {
  country: string | null;
  region: string | null;
  city: string | null;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  browser: string | null;
  os: string | null;
  hourOfDay: number; // 0-23 in UTC
  timeOfDay: string; // 'morning' | 'afternoon' | 'evening' | 'night'
}

// Cache for geolocation data to reduce API calls
const geolocationCache = new Map<string, { data: GeolocationData; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Extract IP address from request headers
 */
export function getClientIP(req: NextRequest): string | null {
  // Check various headers for IP address
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }

  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }

  // Fallback to connection remote address (may not work in serverless)
  return null;
}

/**
 * Get country/region from Cloudflare headers (if available)
 */
function getCountryFromHeaders(req: NextRequest): GeolocationData | null {
  const cfCountry = req.headers.get('cf-ipcountry');
  const xCloudflareCountry = req.headers.get('x-cloudflare-ipcountry');
  const clientCountry = req.headers.get('x-client-country');

  const country = cfCountry || xCloudflareCountry || clientCountry;
  
  if (country && country !== 'XX' && country.length === 2) {
    return {
      country: country.toUpperCase(),
      region: null,
      city: null,
    };
  }

  return null;
}

/**
 * Get geolocation data from IP using ipapi.co
 * Includes caching to reduce API calls
 */
export async function getGeolocationFromIP(ip: string): Promise<GeolocationData> {
  // Check cache first
  const cached = geolocationCache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Use ipapi.co free tier API
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: {
        'User-Agent': 'AGV-Analytics/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`IP geolocation API returned ${response.status}`);
    }

    const data = await response.json();

    // Handle rate limiting or errors
    if (data.error || !data.country_code) {
      return {
        country: null,
        region: null,
        city: null,
      };
    }

    const geolocationData: GeolocationData = {
      country: data.country_code || null,
      region: data.region || data.region_code || null,
      city: data.city || null,
    };

    // Cache the result
    geolocationCache.set(ip, {
      data: geolocationData,
      timestamp: Date.now(),
    });

    return geolocationData;
  } catch (error) {
    console.error('Error fetching geolocation:', error);
    return {
      country: null,
      region: null,
      city: null,
    };
  }
}

/**
 * Get geolocation data from request (headers first, then IP fallback)
 */
export async function getGeolocation(req: NextRequest): Promise<GeolocationData> {
  // Try headers first (Cloudflare, Vercel, etc.)
  const headerData = getCountryFromHeaders(req);
  if (headerData && headerData.country) {
    return headerData;
  }

  // Fallback to IP geolocation
  const ip = getClientIP(req);
  if (!ip) {
    return {
      country: null,
      region: null,
      city: null,
    };
  }

  // Skip localhost/private IPs
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return {
      country: null,
      region: null,
      city: null,
    };
  }

  return await getGeolocationFromIP(ip);
}

/**
 * Parse device information from User-Agent
 */
export function getDeviceData(req: NextRequest): DeviceData {
  const userAgent = req.headers.get('user-agent') || '';
  
  if (!userAgent) {
    return {
      deviceType: 'unknown',
      browser: null,
      os: null,
      userAgent: null,
    };
  }

  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  // Determine device type
  let deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown' = 'unknown';
  
  if (result.device.type === 'mobile') {
    deviceType = 'mobile';
  } else if (result.device.type === 'tablet') {
    deviceType = 'tablet';
  } else if (result.device.type === 'desktop' || (!result.device.type && result.os.name)) {
    deviceType = 'desktop';
  }

  return {
    deviceType,
    browser: result.browser.name ? `${result.browser.name}${result.browser.version ? ` ${result.browser.version}` : ''}` : null,
    os: result.os.name ? `${result.os.name}${result.os.version ? ` ${result.os.version}` : ''}` : null,
    userAgent: userAgent,
  };
}

/**
 * Get time-of-day category from hour
 */
export function getTimeOfDay(hour: number): string {
  if (hour >= 5 && hour < 12) {
    return 'morning';
  } else if (hour >= 12 && hour < 17) {
    return 'afternoon';
  } else if (hour >= 17 && hour < 21) {
    return 'evening';
  } else {
    return 'night';
  }
}

/**
 * Get complete analytics metadata from request
 */
export async function getAnalyticsMetadata(req: NextRequest): Promise<AnalyticsMetadata> {
  const [geolocation, device] = await Promise.all([
    getGeolocation(req),
    Promise.resolve(getDeviceData(req)),
  ]);

  const now = new Date();
  const hourOfDay = now.getUTCHours();

  return {
    country: geolocation.country,
    region: geolocation.region,
    city: geolocation.city,
    deviceType: device.deviceType,
    browser: device.browser,
    os: device.os,
    hourOfDay,
    timeOfDay: getTimeOfDay(hourOfDay),
  };
}

