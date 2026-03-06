import { Redis } from '@upstash/redis';
import type { Translator } from './translator';
import { config } from 'dotenv';

// Load environment variables
config();

// Initialize Redis with proper error handling
let redis: Redis | null = null;
try {
  // Check if Redis environment variables are available
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (redisUrl && redisToken) {
    redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
    console.log('✅ Redis connected successfully');
  } else {
    console.warn('⚠️ Redis environment variables not found, translations will not be cached');
  }
} catch (error) {
  console.warn('⚠️ Redis connection failed, translations will not be cached:', error);
}

export async function translateWithCache(
  translator: Translator,
  { text, from, to, version = 'v1' }: {
    text: string;
    from: string;
    to: string;
    version?: string;
  }
): Promise<string> {
  // Create cache key with version, source, target, and content hash
  const contentHash = Buffer.from(text).toString('base64').slice(0, 32);
  const key = `tr:${version}:${from}:${to}:${contentHash}`;
  
  try {
    // Try to get from cache first if Redis is available
    // if (redis) {
    //   const cached = await redis.get<string>(key);
    //   if (cached) {
    //     console.log(`🎯 Cache HIT: ${text.substring(0, 30)}...`);
    //     return cached;
    //   } else {
    //     console.log(`💾 Cache MISS: ${text.substring(0, 30)}...`);
    //   }
    // }

    // If not in cache, translate and store
    const translated = await translator.translate({ text, from, to });
    
    // Cache for 30 days if Redis is available
    if (redis) {
      try {
        await redis.set(key, translated, { ex: 60 * 60 * 24 * 30 });
      } catch (cacheError) {
        console.warn('Failed to cache translation:', cacheError);
      }
    }
    
    return translated;
  } catch (error) {
    console.error('Translation error:', error);
    // Fallback to direct translation if cache fails
    return translator.translate({ text, from, to });
  }
}

export async function translateMessage(
  translator: Translator,
  { text, from, to }: {
    text: string;
    from: string;
    to: string;
  }
): Promise<string> {
  return translateWithCache(translator, { text, from, to });
}

export async function translateObject(
  translator: Translator,
  { obj, from, to }: {
    obj: Record<string, unknown>;
    from: string;
    to: string;
  }
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = await translateMessage(translator, { text: value, from, to });
    } else if (typeof value === 'object' && value !== null) {
      result[key] = await translateObject(translator, { obj: value as Record<string, unknown>, from, to });
    } else {
      result[key] = value;
    }
  }
  
  return result;
}